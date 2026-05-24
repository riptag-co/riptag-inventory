'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus, IconTrash, IconLoader2 } from '@tabler/icons-react';
import { GlassCard } from '@/components/ui';
import { cn, formatUsd } from '@/lib/utils';
import { updateWishlist, createWishlistItem, deleteWishlistItem } from '@/app/actions';

type WishlistRow = {
  id: string;
  description: string;
  targetQty: number | null;
  supplierPrice: string | number | null;
  leadTimeDays: number | null;
  inStock: string | null;
  notes: string | null;
  status: 'open' | 'promoted' | 'rejected';
};

export function WishlistTable({ items, readOnly = false }: { items: WishlistRow[]; readOnly?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleAdd = () => {
    startTransition(async () => {
      await createWishlistItem({});
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <WishCard key={item.id} item={item} readOnly={readOnly} />
      ))}
      {!readOnly && (
        <button
          onClick={handleAdd}
          disabled={pending}
          className="glass glass-hover min-h-[140px] flex flex-col items-center justify-center gap-2 text-text-tertiary hover:text-text-primary cursor-pointer disabled:opacity-50"
        >
          {pending ? (
            <IconLoader2 size={22} className="animate-spin" />
          ) : (
            <>
              <IconPlus size={22} strokeWidth={1.5} />
              <span className="text-[11px] font-medium">Add idea</span>
            </>
          )}
        </button>
      )}
      {readOnly && items.length === 0 && (
        <div className="col-span-full text-text-tertiary text-center py-12 text-sm">No wishlist items.</div>
      )}
    </div>
  );
}

function WishCard({ item, readOnly }: { item: WishlistRow; readOnly: boolean }) {
  const router = useRouter();
  const [desc, setDesc] = useState(item.description);
  const [qty, setQty] = useState(item.targetQty?.toString() ?? '');
  const [price, setPrice] = useState(item.supplierPrice != null ? String(item.supplierPrice) : '');
  const [notes, setNotes] = useState(item.notes ?? '');

  const save = async (field: string, value: any) => {
    await updateWishlist(item.id, field, value);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this wishlist item?')) return;
    await deleteWishlistItem(item.id);
    router.refresh();
  };

  return (
    <GlassCard className="group relative p-3 flex flex-col gap-2">
      {!readOnly && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-bad/80 hover:border-bad transition"
          title="Delete"
        >
          <IconTrash size={11} />
        </button>
      )}

      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => desc !== item.description && save('description', desc)}
        disabled={readOnly}
        rows={2}
        placeholder="What do you want?"
        className="sheet-input text-[13px] font-medium resize-none pr-8"
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] uppercase tracking-wider text-text-tertiary block mb-0.5">Qty</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => save('targetQty', qty)}
            disabled={readOnly}
            placeholder="—"
            className="sheet-input num-display text-[12px]"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wider text-text-tertiary block mb-0.5">$ each</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => save('supplierPrice', price)}
            disabled={readOnly}
            placeholder="—"
            className="sheet-input num-display text-[12px]"
          />
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== (item.notes ?? '') && save('notes', notes)}
        disabled={readOnly}
        rows={1}
        placeholder="Notes (optional)"
        className="sheet-input text-[11px] text-text-secondary resize-none"
      />

      <div className="flex items-center justify-between">
        <select
          value={item.status}
          onChange={(e) => save('status', e.target.value)}
          disabled={readOnly}
          className={cn(
            'bg-transparent border border-white/[0.06] rounded-full px-2 py-0.5 text-[10px] cursor-pointer',
            item.status === 'open' && 'text-info',
            item.status === 'promoted' && 'text-ok',
            item.status === 'rejected' && 'text-text-tertiary line-through'
          )}
        >
          <option value="open" className="bg-bg-base text-text-primary">open</option>
          <option value="promoted" className="bg-bg-base text-text-primary">promoted</option>
          <option value="rejected" className="bg-bg-base text-text-primary">rejected</option>
        </select>
        {price && Number(price) > 0 && qty && Number(qty) > 0 && (
          <span className="text-[10px] text-text-tertiary num-display">
            ≈ {formatUsd(Number(price) * Number(qty))}
          </span>
        )}
      </div>
    </GlassCard>
  );
}
