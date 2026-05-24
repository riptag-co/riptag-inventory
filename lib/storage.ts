import path from 'path';
import fs from 'fs/promises';

export const STORAGE_ROOT = process.env.STORAGE_PATH || '/data';
export const CATALOG_DIR = path.join(STORAGE_ROOT, 'catalog');

export async function ensureCatalogDir() {
  await fs.mkdir(CATALOG_DIR, { recursive: true });
}

const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export function extForMime(mime: string): string | null {
  return ALLOWED_EXT[mime.toLowerCase()] ?? null;
}

export function contentTypeForFile(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
}

export function safeBasename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}
