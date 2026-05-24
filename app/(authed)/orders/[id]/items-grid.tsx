'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus, IconTrash, IconLoader2, IconBox, IconSearch, IconX } from '@tabler/icons-react';
import { GlassCard } from '@/components/ui';
import { cn, formatUsd, formatNum } from '@/lib/utils';
import { updateOrderItem, createOrderItem, deleteOrderItem } from '@/app/actions';
import type { OrderItemFull } from '@/lib/db/queries';

type CatalogProduct = {
  sku: string;
  name: string;
  imageUrl: string | null;
  unitCost: string;
};

export function OrderItemsGrid({
  orderId,
  items,
  catalog,
  readOnly,
}: {
  orderId: string;
  items: OrderItemFull[];
  catalog: CatalogProduct[];
  readOnly: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const router = useRouter();

  const usedSkus = new Set(items.map((i) => i.sku));

  const handlePick = async (p: CatalogProduct) => {
    setPickerOpen(false);
    await createOrderItem(orderId, {
      sku: p.sku,
      qty: 1,
      price: Number(p.unitCost) || 0,
    });
    router.refresh();
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((item) => (
          <LineCard key={item.id} item={item} readOnly={readOnly} />
        ))}
        {!readOnly && (
          <button
            onClick={() => setPickerOpen(true)}
            className="glass glass-hover aspect-[3/4] flex flex-col items-center justify-center gap-2 text-text-tertiary hover:text-text-primary cursor-pointer"
          >
            <IconPlus size={28} strokeWidth={1.5} />
            <span className="text-[12px] font-medium">Add product</span>
          </button>
        )}
        {readOnly && items.length === 0 && (
          <div className="col-span-full text-center text-text-tertiary text-sm py-12">
            No items in this order yet.
          </div>
        )}
      </div>

      {pickerOpen && (
        <ProductPicker
          catalog={catalog}
          usedSkus={usedSkus}
          onPick={handlePick}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

function LineCard({ item, readOnly }: { item: OrderItemFull; readOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(String(item.qtyOrdered));
  const [price, setPrice] = useState(item.unitPrice.toString());

  const saveQty = () => {
    const n = parseInt(qty, 10);
    if (isNaN(n) || n === item.qtyOrdered) return;
    startTransition(async () => {
      await updateOrderItem(item.id, 'qtyOrdered', n);
      router.refresh();
    });
  };

  const savePrice = () => {
    const n = parseFloat(price);
    if (isNaN(n) || n === item.unitPrice) return;
    startTransition(async () => {
      await updateOrderItem(item.id, 'unitPrice', n);
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm(`Remove ${item.sku} from this order?`)) return;
    startTransition(async () => {
      await deleteOrderItem(item.id);
      router.refresh();
    });
  };

  const lineTotal = (Number(qty) || 0) * (Number(price) || 0);

  return (
    <GlassCard className="group relative overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-white/[0.02] border-b border-white/[0.04]">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.productName ?? ''} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-tertiary">
            <IconBox size={28} strokeWidth={1.5} />
          </div>
        )}
        {!readOnly && (
          <button
            onClick={handleDelete}
            disabled={pending}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-bad/80 hover:border-bad transition"
            title="Remove from order"
          >
            <IconTrash size={13} />
          </button>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-accent">{item.sku}</div>
          <div className="text-[12px] font-medium text-text-primary leading-snug line-clamp-2 mt-0.5">
            {item.productName ?? <span className="text-text-tertiary italic">Unknown</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mt-1">
          <div>
            <label className="text-[9px] uppercase tracking-wider text-text-tertiary block leading-none mb-1">Qty</label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={saveQty}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              disabled={readOnly}
              className="sheet-input num-display text-[13px] font-semibold"
            />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wider text-text-tertiary block leading-none mb-1">$ each</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={savePrice}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              disabled={readOnly}
              className="sheet-input num-display text-[12px]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.04] pt-2 mt-1">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Line</span>
          <span className="text-[13px] font-semibold text-accent num-display">{formatUsd(lineTotal)}</span>
        </div>
      </div>
    </GlassCard>
  );
}

function ProductPicker({
  catalog,
  usedSkus,
  onPick,
  onClose,
}: {
  catalog: CatalogProduct[];
  usedSkus: Set<string>;
  onPick: (p: CatalogProduct) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = catalog.filter(
    (p) => !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-5xl p-6 mt-12 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-[20px] font-semibold">Pick a product</h2>
            <p className="text-[12px] text-text-tertiary mt-0.5">
              Click any catalog item to add it to this order.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="relative mb-5">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SKU or name…"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-[13px] focus:border-accent/50 focus:bg-white/[0.05] outline-none"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-text-tertiary text-sm">
            No products match "{query}". Add one in the Catalog tab.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((p) => {
              const used = usedSkus.has(p.sku);
              return (
                <button
                  key={p.sku}
                  onClick={() => onPick(p)}
                  disabled={used}
                  className={cn(
                    'group glass aspect-[3/4] flex flex-col text-left overflow-hidden transition',
                    used ? 'opacity-40 cursor-not-allowed' : 'glass-hover hover:border-accent/40 cursor-pointer'
                  )}
                  title={used ? 'Already in this order' : `Add ${p.sku}`}
                >
                  <div className="aspect-square bg-white/[0.02]">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-tertiary">
                        <IconBox size={22} />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="font-mono text-[10px] uppercase text-accent">{p.sku}</div>
                    <div className="text-[11px] text-text-primary leading-snug line-clamp-2 mt-0.5">
                      {p.name}
                    </div>
                    {Number(p.unitCost) > 0 && (
                      <div className="text-[10px] text-text-tertiary num-display mt-1">
                        {formatUsd(Number(p.unitCost))} each
                      </div>
                    )}
                    {used && <div className="text-[9px] text-warn mt-1">Already added</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
