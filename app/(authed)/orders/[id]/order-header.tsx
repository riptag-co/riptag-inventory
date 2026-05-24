'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconCheck, IconLoader2, IconCash } from '@tabler/icons-react';
import { GlassCard } from '@/components/ui';
import { cn, formatUsd, formatDate } from '@/lib/utils';
import { updateOrder } from '@/app/actions';

export function OrderHeader({
  orderId,
  paid,
  paymentDate,
  shippingCost,
  subtotal,
  total,
  notes,
  readOnly,
}: {
  orderId: string;
  paid: boolean;
  paymentDate: string | null;
  shippingCost: number;
  subtotal: number;
  total: number;
  notes: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(notes ?? '');
  const [editingShipping, setEditingShipping] = useState(false);
  const [shipValue, setShipValue] = useState(String(shippingCost));

  const togglePaid = () => {
    startTransition(async () => {
      await updateOrder(orderId, 'paid', !paid);
      if (!paid) {
        await updateOrder(orderId, 'paymentDate', new Date().toISOString().slice(0, 10));
      }
      router.refresh();
    });
  };

  const saveNotes = async () => {
    setEditingNotes(false);
    if (notesValue === (notes ?? '')) return;
    await updateOrder(orderId, 'notes', notesValue);
    router.refresh();
  };

  const saveShipping = async () => {
    setEditingShipping(false);
    const n = parseFloat(shipValue);
    if (isNaN(n) || n === shippingCost) return;
    await updateOrder(orderId, 'shippingCost', n);
    router.refresh();
  };

  const accentClass = paid ? 'order-paid' : 'order-unpaid';

  return (
    <>
      <div className={cn('rounded-2xl border p-5 mb-3', paid ? 'border-ok/30 bg-ok/[0.04]' : 'border-warn/30 bg-warn/[0.04]')}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center border',
                paid ? 'bg-ok/15 border-ok/40 text-ok' : 'bg-warn/15 border-warn/40 text-warn'
              )}
            >
              {paid ? <IconCheck size={18} stroke={2.5} /> : <IconCash size={18} stroke={2} />}
            </div>
            <div>
              <div className={cn('text-[13px] font-semibold uppercase tracking-wider', paid ? 'text-ok' : 'text-warn')}>
                {paid ? 'Paid' : 'Pending payment'}
              </div>
              <div className="text-[11px] text-text-tertiary mt-0.5">
                {paid && paymentDate
                  ? `Paid on ${formatDate(paymentDate)}`
                  : 'Supplier waits for payment before shipping'}
              </div>
            </div>
          </div>

          {!readOnly && (
            <button
              onClick={togglePaid}
              disabled={pending}
              className={cn(
                'px-4 py-2 rounded-lg text-[13px] font-medium border transition disabled:opacity-50 inline-flex items-center gap-2',
                paid
                  ? 'border-white/[0.08] text-text-secondary hover:bg-white/[0.04]'
                  : 'bg-accent text-white border-accent hover:bg-accent/90'
              )}
            >
              {pending && <IconLoader2 size={14} className="animate-spin" />}
              {paid ? 'Mark unpaid' : 'Mark as paid'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <GlassCard className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Goods</div>
          <div className="num-display text-[22px] font-semibold mt-1.5">{formatUsd(subtotal)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Shipping</div>
          {editingShipping && !readOnly ? (
            <input
              autoFocus
              type="number"
              step="0.01"
              value={shipValue}
              onChange={(e) => setShipValue(e.target.value)}
              onBlur={saveShipping}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="sheet-input num-display text-[22px] font-semibold mt-1.5 -ml-2"
            />
          ) : (
            <button
              disabled={readOnly}
              onClick={() => !readOnly && setEditingShipping(true)}
              className={cn(
                'num-display text-[22px] font-semibold mt-1.5 text-left -ml-2 px-2 rounded',
                !readOnly && 'hover:bg-white/[0.04] cursor-text'
              )}
            >
              {formatUsd(shippingCost)}
            </button>
          )}
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Total</div>
          <div className="num-display text-[22px] font-semibold mt-1.5 text-accent">{formatUsd(total)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Notes</div>
          {editingNotes && !readOnly ? (
            <textarea
              autoFocus
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              onBlur={saveNotes}
              rows={2}
              className="sheet-input text-[13px] mt-1.5 -ml-2 resize-none"
              placeholder="Anything to remember…"
            />
          ) : (
            <button
              disabled={readOnly}
              onClick={() => !readOnly && setEditingNotes(true)}
              className={cn(
                'text-[13px] text-text-secondary text-left mt-1.5 leading-snug line-clamp-2 -ml-2 px-2 rounded',
                !readOnly && 'hover:bg-white/[0.04] cursor-text'
              )}
            >
              {notes || <span className="text-text-tertiary italic">Click to add…</span>}
            </button>
          )}
        </GlassCard>
      </div>
    </>
  );
}
