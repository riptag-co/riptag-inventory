/**
 * Parse the Depop catalog HTML export and emit a deduped JSON list of products.
 * Usage: node scripts/parse-depop.mjs <html-path> [out.json]
 */
import fs from 'fs/promises';
import path from 'path';

const htmlPath = process.argv[2];
const outPath = process.argv[3] || path.join('scripts', 'seed-catalog.json');

if (!htmlPath) {
  console.error('Usage: node scripts/parse-depop.mjs <html-path> [out.json]');
  process.exit(1);
}

const html = await fs.readFile(htmlPath, 'utf8');

// Each card is <div class="card">...</div>
// Easiest: split on '<div class="card">' then parse the rest.
const chunks = html.split('<div class="card">').slice(1);
console.log(`Found ${chunks.length} card chunks.`);

const titleRe = /class="t"><a href="([^"]+)"[^>]*>([^<]+)<\/a>/;
const priceRe = /class="p">\$?([\d.]+)/;

const items = [];
for (const chunk of chunks) {
  const titleMatch = chunk.match(titleRe);
  if (!titleMatch) continue;
  const url = titleMatch[1];
  const title = titleMatch[2].trim();
  const priceMatch = chunk.match(priceRe);
  const price = priceMatch ? Number(priceMatch[1]) : null;
  items.push({ title, url, price });
}

console.log(`Parsed ${items.length} items total.`);

// Dedupe by normalized title (case-insensitive, whitespace-collapsed)
const seen = new Map();
for (const item of items) {
  const key = item.title.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!seen.has(key)) {
    seen.set(key, item);
  }
}
const unique = Array.from(seen.values());
console.log(`After dedupe: ${unique.length} unique titles.`);

// Assign SKUs
const seed = unique.map((item, i) => ({
  sku: `SKU-${String(i + 1).padStart(3, '0')}`,
  name: item.title,
  depopUrl: item.url,
  suggestedPrice: item.price,
  imageUrl: null, // filled in by fetch-depop-images.mjs
}));

await fs.writeFile(outPath, JSON.stringify(seed, null, 2));
console.log(`Wrote ${seed.length} products to ${outPath}`);
