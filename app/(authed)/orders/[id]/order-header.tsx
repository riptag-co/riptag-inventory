'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconCheck,
  IconLoader2,
  IconCash,
  IconSend,
  IconAlertCircle,
  IconFilePencil,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { GlassCard } from '@/components/ui';
import { cn, formatUsd, formatDate } from '@/lib/utils';
import { updateOrder, promoteDraftOrder, revertToDraft } from '@/app/actions';

type OrderStatus = 'draft' | 'pending_payment' | 'paid' | string;

export function OrderHeader({
  orderId,
  status,
  paid,
  paymentDate,
  shippingCost,
  subtotal,
  total,
  notes,
  readOnly,
  isOwner,
  itemCount,
  hasZeroPriceItems,
}: {
  orderId: string;
  status: OrderStatus;
  paid: boolean;
  paymentDate: string | null;
  shippingCost: number;
  subtotal: number;
  total: number;
  notes: string | null;
  readOnly: boolean;
  isOwner: boolean;
  itemCount: number;
  hasZeroPriceItems: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(notes ?? '');
  const [editingShipping, setEditingShipping] = useState(false);
  const [shipValue, setShipValue] = useState(String(shippingCost));
  const [error, setError] = useState<string | null>(null);

  const isDraft = status === 'draft';

  const togglePaid = () => {
    startTransition(async () => {
      await updateOrder(orderId, 'paid', !paid);
      if (!paid) {
        await updateOrder(orderId, 'paymentDate', new Date().toISOString().slice(0, 10));
      }
      router.refresh();
    });
  };

  const promote = () => {
    setError(null);
    startTransition(async () => {
      try {
        await promoteDraftOrder(orderId);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Could not promote');
      }
    });
  };

  const sendBackToDraft = () => {
    if (!confirm('Send this back to drafts? It will leave the Orders tab.')) return;
    startTransition(async () => {
      await revertToDraft(orderId);
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

  // Banner appearance
  const banner = isDraft
    ? { color: 'neutral', label: 'Draft — waiting for supplier price', icon: IconFilePencil, tone: 'text-text-secondary', bg: 'border-white/[0.08] bg-white/[0.02]' }
    : paid
    ? { color: 'ok', label: 'Paid', icon: IconCheck, tone: 'text-ok', bg: 'border-ok/30 bg-ok/[0.04]' }
    : { color: 'warn', label: 'Pending payment', icon: IconCash, tone: 'text-warn', bg: 'border-warn/30 bg-warn/[0.04]' };

  const Icon = banner.icon;

  return (
    <>
      <div className={cn('rounded-2xl border p-5 mb-3', banner.bg)}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center border',
                isDraft && 'bg-white/[0.04] border-white/[0.08] text-text-secondary',
                !isDraft && paid && 'bg-ok/15 border-ok/40 text-ok',
                !isDraft && !paid && 'bg-warn/15 border-warn/40 text-warn'
              )}
            >
              <Icon size={18} stroke={2} />
            </div>
            <div>
              <div className={cn('text-[13px] font-semibold uppercase tracking-wider', banner.tone)}>
                {banner.label}
              </div>
              <div className="text-[11px] text-text-tertiary mt-0.5">
                {isDraft
                  ? hasZeroPriceItems
                    ? 'Supplier hasn\'t set prices for every item yet.'
                    : 'Ready to send — supplier has priced everything.'
                  : paid && paymentDate
                  ? `Paid on ${formatDate(paymentDate)}`
                  : 'Supplier waits for payment before shipping'}
              </div>
            </div>
          </div>

          {!readOnly && isOwner && (
            <div className="flex items-center gap-2">
              {isDraft ? (
                <button
                  onClick={promote}
                  disabled={pending || itemCount === 0 || hasZeroPriceItems}
                  className={cn(
                    'px-4 py-2 rounded-lg text-[13px] font-medium border transition inline-flex items-center gap-2',
                    !pending && !hasZeroPriceItems && itemCount > 0
                      ? 'bg-accent text-white border-accent hover:bg-accent/90'
                      : 'bg-white/[0.03] text-text-tertiary border-white/[0.06] cursor-not-allowed'
                  )}
                  title={
                    itemCount === 0
                      ? 'Add items first'
                      : hasZeroPriceItems
                      ? 'Supplier must price every item'
                      : 'Move to Orders for payment'
                  }
                >
                  {pending ? <IconLoader2 size={14} className="animate-spin" /> : <IconSend size={14} />}
                  Send to Orders
                </button>
              ) : (
                <>
                  {!paid && (
                    <button
                      onClick={sendBackToDraft}
                      disabled={pending}
                      className="px-3 py-2 rounded-lg text-[12px] font-medium border border-white/[0.08] text-text-secondary hover:bg-white/[0.04] inline-flex items-center gap-1.5"
                    >
                      <IconArrowBackUp size={13} /> Back to draft
                    </button>
                  )}
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
                </>
              )}
            </div>
          )}
        </div>
        {error && (
          <div className="mt-3 text-[11px] text-bad inline-flex items-center gap-1.5">
            <IconAlertCircle size={12} /> {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <GlassCard className="p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Total</div>
            {!isDraft && (
              <span className="text-[10px] text-text-tertiary">
                {formatUsd(subtotal)} goods
                {shippingCost > 0 && ` + ${formatUsd(shippingCost)} shipping`}
              </span>
            )}
          </div>
          <div className="num-display text-[28px] font-semibold mt-1.5 text-accent">{formatUsd(total)}</div>
          {!readOnly && !isDraft && (
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Shipping</span>
              {editingShipping ? (
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  value={shipValue}
                  onChange={(e) => setShipValue(e.target.value)}
                  onBlur={saveShipping}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="sheet-input num-display text-[12px] w-24"
                />
              ) : (
                <button
                  onClick={() => setEditingShipping(true)}
                  className="text-[12px] num-display text-text-secondary hover:bg-white/[0.04] px-1.5 -mx-1.5 rounded cursor-text"
                >
                  {formatUsd(shippingCost)}
                </button>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Notes</div>
          {editingNotes && !readOnly ? (
            <textarea
              autoFocus
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              onBlur={saveNotes}
              rows={3}
              className="sheet-input text-[13px] mt-1.5 -ml-2 resize-none"
              placeholder="Anything to remember…"
            />
          ) : (
            <button
              disabled={readOnly}
              onClick={() => !readOnly && setEditingNotes(true)}
              className={cn(
                'text-[13px] text-text-secondary text-left mt-1.5 leading-snug line-clamp-3 -ml-2 px-2 rounded block w-full',
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
