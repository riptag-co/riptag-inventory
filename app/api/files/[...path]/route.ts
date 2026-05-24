import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { STORAGE_ROOT, contentTypeForFile } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const rel = params.path.join('/');
  const abs = path.normalize(path.join(STORAGE_ROOT, rel));

  if (!abs.startsWith(path.normalize(STORAGE_ROOT) + path.sep) && abs !== path.normalize(STORAGE_ROOT)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const data = await fs.readFile(abs);
    const body = new Uint8Array(data);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentTypeForFile(abs),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
