import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { requireOwner } from '@/lib/auth';
import { CATALOG_DIR, ensureCatalogDir, extForMime } from '@/lib/storage';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  await requireOwner();

  const form = await req.formData();
  const sku = String(form.get('sku') ?? '').trim();
  const file = form.get('file');

  if (!sku) return NextResponse.json({ error: 'Missing sku' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

  const ext = extForMime(file.type);
  if (!ext) return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 8 MB)' }, { status: 413 });

  const existing = await db.select({ sku: products.sku }).from(products).where(eq(products.sku, sku)).limit(1);
  if (existing.length === 0) return NextResponse.json({ error: 'Unknown SKU' }, { status: 404 });

  await ensureCatalogDir();
  const filename = `${sku}-${randomBytes(4).toString('hex')}${ext}`;
  const dest = path.join(CATALOG_DIR, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(dest, bytes);

  const url = `/api/files/catalog/${filename}`;
  await db.update(products).set({ imageUrl: url, updatedAt: new Date() }).where(eq(products.sku, sku));

  return NextResponse.json({ url });
}
