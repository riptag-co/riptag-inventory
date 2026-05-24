/**
 * Bulk-upload images to the live catalog via /api/upload.
 *
 * Two modes:
 *   1. By matching filename — if your image filenames look like "SKU-001.jpg" etc., pass --by-filename
 *   2. By ordering — pass an --order=alpha to upload files sorted alphabetically against SKU-001, SKU-002, ...
 *
 * Required env (.env or shell):
 *   APP_URL          e.g. https://riptag-inventory-production.up.railway.app
 *   OWNER_EMAIL      your login
 *   OWNER_PASSWORD   your password
 *
 * Usage:
 *   node scripts/upload-catalog-images.mjs <images-folder> [--by-filename | --order=alpha]
 *
 * Example:
 *   node scripts/upload-catalog-images.mjs "C:/Users/hvill/Downloads/beverlyclub - Depop Catalog (181)_files" --order=alpha
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';

const args = process.argv.slice(2);
const folder = args[0];
const mode = args.includes('--by-filename') ? 'by-filename' : 'by-order';

if (!folder) {
  console.error('Usage: node scripts/upload-catalog-images.mjs <images-folder> [--by-filename]');
  process.exit(1);
}

const APP_URL = process.env.APP_URL;
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
if (!APP_URL || !OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('Set APP_URL, OWNER_EMAIL, and OWNER_PASSWORD in your env (.env file) before running.');
  process.exit(1);
}

// 1. Log in to get a session cookie
const loginRes = await fetch(`${APP_URL}/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  redirect: 'manual',
});

const setCookie = loginRes.headers.get('set-cookie');
if (!setCookie) {
  console.error('Login failed — no session cookie returned. Status:', loginRes.status);
  process.exit(1);
}
const cookie = setCookie.split(';')[0];
console.log('✓ Logged in.');

// 2. Read seed-catalog.json so we know the SKU list
const seedPath = path.resolve('scripts', 'seed-catalog.json');
const seed = JSON.parse(await fs.readFile(seedPath, 'utf8'));

// 3. Read images from folder
const imageExt = /\.(jpe?g|png|webp|gif)$/i;
const allFiles = await fs.readdir(folder);
const images = allFiles.filter((f) => imageExt.test(f)).sort();
console.log(`Found ${images.length} image files in ${folder}`);

// 4. Build SKU -> image filename map
const pairs = [];
if (mode === 'by-filename') {
  for (const file of images) {
    const skuMatch = file.match(/SKU-\d{3}/i);
    if (skuMatch) {
      pairs.push({ sku: skuMatch[0].toUpperCase(), file });
    }
  }
} else {
  // by-order: zip sorted images against sorted SKUs
  for (let i = 0; i < Math.min(images.length, seed.length); i++) {
    pairs.push({ sku: seed[i].sku, file: images[i] });
  }
}

console.log(`Will upload ${pairs.length} image(s).`);

// 5. Upload each
let ok = 0;
let failed = 0;
for (const { sku, file } of pairs) {
  const fullPath = path.join(folder, file);
  const buf = await fs.readFile(fullPath);
  const form = new FormData();
  form.append('sku', sku);
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  form.append('file', new Blob([buf], { type: mime }), file);

  const res = await fetch(`${APP_URL}/api/upload`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  });

  if (res.ok) {
    const body = await res.json();
    console.log(`  ✓ ${sku} ← ${file}  (${body.url})`);
    ok++;
  } else {
    const body = await res.text();
    console.log(`  ✗ ${sku} ← ${file}  ${res.status} ${body.slice(0, 200)}`);
    failed++;
  }
}

console.log(`\nDone. ${ok} uploaded, ${failed} failed.`);
