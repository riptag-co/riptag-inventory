'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPhotoPlus, IconTrash, IconPlus, IconLoader2 } from '@tabler/icons-react';
import { GlassCard } from '@/components/ui';
import { cn } from '@/lib/utils';
import { updateProduct, createProduct, deleteProduct } from '@/app/actions';

export type ProductCard = {
  sku: string;
  name: string;
  imageUrl: string | null;
};

export function CatalogGrid({
  products,
  readOnly,
}: {
  products: ProductCard[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleAdd = () => {
    startTransition(async () => {
      await createProduct({});
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {products.map((p) => (
        <Card key={p.sku} product={p} readOnly={readOnly} />
      ))}
      {!readOnly && (
        <button
          onClick={handleAdd}
          disabled={pending}
          className="glass glass-hover aspect-[3/4] flex flex-col items-center justify-center gap-3 text-text-tertiary hover:text-text-primary cursor-pointer disabled:opacity-50"
        >
          {pending ? (
            <IconLoader2 size={28} className="animate-spin" />
          ) : (
            <>
              <IconPlus size={28} strokeWidth={1.5} />
              <span className="text-[12px] font-medium">Add product</span>
            </>
          )}
        </button>
      )}
      {readOnly && products.length === 0 && (
        <div className="col-span-full text-center text-text-tertiary text-sm py-12">
          Catalog is empty.
        </div>
      )}
    </div>
  );
}

function Card({ product, readOnly }: { product: ProductCard; readOnly: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingSku, setEditingSku] = useState(false);
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveName = async () => {
    setEditingName(false);
    if (name === product.name) return;
    await updateProduct(product.sku, 'name', name);
    router.refresh();
  };

  const saveSku = async () => {
    setEditingSku(false);
    const trimmed = sku.trim().toUpperCase();
    if (trimmed === product.sku || !trimmed) {
      setSku(product.sku);
      return;
    }
    await updateProduct(product.sku, 'sku', trimmed);
    router.refresh();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('sku', product.sku);
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Upload failed' }));
        setError(body.error || 'Upload failed');
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${product.sku} — ${product.name}?`)) return;
    await deleteProduct(product.sku);
    router.refresh();
  };

  return (
    <GlassCard className="group relative overflow-hidden flex flex-col">
      <div
        className={cn(
          'relative aspect-square bg-white/[0.02] border-b border-white/[0.04]',
          !readOnly && 'cursor-pointer'
        )}
        onClick={() => !readOnly && !uploading && fileRef.current?.click()}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-text-tertiary gap-2">
            <IconPhotoPlus size={32} strokeWidth={1.5} />
            {!readOnly && <span className="text-[11px] font-medium">Click to upload</span>}
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
            <IconLoader2 size={28} className="animate-spin text-accent" />
          </div>
        )}
        {!readOnly && product.imageUrl && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="text-[11px] font-medium text-white">Click to replace</span>
          </div>
        )}
        {!readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-bad/80 hover:border-bad transition"
            title="Delete"
          >
            <IconTrash size={14} />
          </button>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1">
        {editingSku && !readOnly ? (
          <input
            autoFocus
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            onBlur={saveSku}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setSku(product.sku);
                setEditingSku(false);
              }
            }}
            className="sheet-input font-mono text-[11px] uppercase tracking-wide text-accent"
          />
        ) : (
          <button
            disabled={readOnly}
            onClick={() => !readOnly && setEditingSku(true)}
            className={cn(
              'text-left font-mono text-[11px] uppercase tracking-wide text-accent truncate',
              !readOnly && 'hover:bg-white/[0.04] rounded px-1 -mx-1 cursor-text'
            )}
          >
            {product.sku}
          </button>
        )}

        {editingName && !readOnly ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setName(product.name);
                setEditingName(false);
              }
            }}
            className="sheet-input text-[13px] font-medium"
          />
        ) : (
          <button
            disabled={readOnly}
            onClick={() => !readOnly && setEditingName(true)}
            className={cn(
              'text-left text-[13px] font-medium text-text-primary leading-snug',
              !readOnly && 'hover:bg-white/[0.04] rounded px-1 -mx-1 cursor-text'
            )}
          >
            {product.name}
          </button>
        )}

        {error && <div className="text-[10px] text-bad mt-1">{error}</div>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
    </GlassCard>
  );
}
