'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  IconPlus,
  IconLoader2,
  IconX,
  IconTrash,
  IconEdit,
  IconCheck,
  IconBox,
  IconTruck,
  IconExternalLink,
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconPackage,
} from '@tabler/icons-react';
import { GlassCard } from '@/components/ui';
import {
  cn,
  formatDate,
  formatNum,
  normalizeShipmentStatus,
  SHIPMENT_STATUS_CHOICES,
  CARRIERS,
  DEFAULT_CARRIER,
  carrierTrackingUrl,
  statusVariant,
} from '@/lib/utils';
import {
  createEmptyShipment,
  updateShipment,
  deleteShipment,
  deleteShipmentItem,
} from '@/app/actions';
import type { ShipmentBox } from '@/lib/db/queries';

const STATUS_OPTIONS = SHIPMENT_STATUS_CHOICES.map((value) => ({
  value,
  label: value === 'preparing' ? 'Preparing' : value === 'shipped' ? 'Shipped' : 'Delivered',
}));

function variantClasses(variant: ReturnType<typeof statusVariant>) {
  switch (variant) {
    case 'ok':
      return { text: 'text-ok', bg: 'bg-ok/15', border: 'border-ok/40', dot: 'bg-ok' };
    case 'warn':
      return { text: 'text-warn', bg: 'bg-warn/15', border: 'border-warn/40', dot: 'bg-warn' };
    case 'info':
      return { text: 'text-info', bg: 'bg-info/15', border: 'border-info/40', dot: 'bg-info' };
    case 'bad':
      return { text: 'text-bad', bg: 'bg-bad/15', border: 'border-bad/40', dot: 'bg-bad' };
    default:
      return { text: 'text-text-secondary', bg: 'bg-white/[0.04]', border: 'border-white/[0.10]', dot: 'bg-text-tertiary' };
  }
}

function StatusPill({ status }: { status: string }) {
  const n = normalizeShipmentStatus(status);
  const cls = variantClasses(statusVariant(n));
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border', cls.text, cls.bg, cls.border)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cls.dot)} />
      {n === 'preparing' ? 'Preparing' : n === 'shipped' ? 'Shipped' : 'Delivered'}
    </span>
  );
}

export function TrackingLink({
  carrier,
  trackingNumber,
  className,
}: {
  carrier: string | null;
  trackingNumber: string | null;
  className?: string;
}) {
  if (!trackingNumber) {
    return <span className={cn('italic text-text-tertiary text-[11px]', className)}>no tracking</span>;
  }
  const url = carrierTrackingUrl(carrier, trackingNumber);
  if (!url) {
    return <span className={cn('font-mono text-[11px] text-text-secondary', className)}>{trackingNumber}</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'font-mono text-[11px] text-info hover:text-info hover:underline inline-flex items-center gap-1',
        className
      )}
      title={`Track on ${carrier}`}
    >
      {trackingNumber}
      <IconExternalLink size={10} />
    </a>
  );
}

export function BoxesGrid({
  boxes,
  readOnly,
}: {
  boxes: ShipmentBox[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleQuickCreate = () => {
    startTransition(async () => {
      await createEmptyShipment({ carrier: DEFAULT_CARRIER });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] text-text-tertiary uppercase tracking-wider">
            {boxes.length} {boxes.length === 1 ? 'box' : 'boxes'} total
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickCreate}
              disabled={pending}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium border border-white/[0.08] text-text-secondary hover:bg-white/[0.04] disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {pending ? <IconLoader2 size={12} className="animate-spin" /> : <IconPlus size={12} />}
              Quick empty box
            </button>
            <button
              onClick={() => setCreating(true)}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-accent text-white hover:bg-accent/90 inline-flex items-center gap-1.5"
            >
              <IconPackage size={13} />
              New box with details
            </button>
          </div>
        </div>
      )}

      {creating && !readOnly && (
        <NewBoxForm onClose={() => setCreating(false)} />
      )}

      {boxes.length === 0 ? (
        <div className="glass p-8 text-center">
          <IconBox size={28} className="mx-auto text-text-tertiary mb-2" />
          <div className="text-[14px] font-medium text-text-secondary">No shipment boxes yet</div>
          <div className="text-[12px] text-text-tertiary mt-1">
            {readOnly
              ? 'Boxes will appear here once the supplier creates them.'
              : 'Create one above, or one will be created automatically when you "Ship some" units in the Orders view.'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {boxes.map((box) => (
            <BoxCard key={box.id} box={box} readOnly={readOnly} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoxCard({ box, readOnly }: { box: ShipmentBox; readOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(box.itemCount > 0 && box.itemCount <= 4);

  const handleDelete = () => {
    if (box.itemCount > 0) {
      alert(`This box has ${box.itemCount} allocations. Remove them first.`);
      return;
    }
    if (!confirm(`Delete empty box ${box.id}?`)) return;
    startTransition(async () => {
      await deleteShipment(box.id);
      router.refresh();
    });
  };

  return (
    <GlassCard className="overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
            <IconPackage size={16} className="text-text-secondary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[14px] text-text-primary">{box.id}</span>
              <span className="text-text-tertiary text-[11px]">·</span>
              <span className="text-[12px] text-text-secondary">{box.carrier ?? 'no carrier'}</span>
            </div>
            <div className="mt-1">
              <TrackingLink carrier={box.carrier} trackingNumber={box.trackingNumber} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={box.status} />
          {!readOnly && (
            <>
              <button
                onClick={() => setEditing(!editing)}
                className="text-text-tertiary hover:text-text-primary p-1.5 rounded hover:bg-white/[0.04]"
                title={editing ? 'Close editor' : 'Edit box'}
              >
                <IconEdit size={13} />
              </button>
              {box.itemCount === 0 && (
                <button
                  onClick={handleDelete}
                  disabled={pending}
                  className="text-text-tertiary hover:text-bad p-1.5 rounded hover:bg-white/[0.04]"
                  title="Delete empty box"
                >
                  <IconTrash size={13} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {editing && !readOnly && (
        <BoxEditor box={box} onClose={() => setEditing(false)} />
      )}

      <div className="px-4 py-3">
        <div className="grid grid-cols-3 gap-2 mb-3 text-[10px] uppercase tracking-wider text-text-tertiary">
          {box.shipDate && (
            <div className="inline-flex items-center gap-1">
              <IconCalendar size={10} /> shipped <span className="text-text-secondary normal-case">{formatDate(box.shipDate)}</span>
            </div>
          )}
          {box.eta && (
            <div className="inline-flex items-center gap-1">
              <IconCalendar size={10} /> eta <span className="text-text-secondary normal-case">{formatDate(box.eta)}</span>
            </div>
          )}
          {box.actualDelivery && (
            <div className="inline-flex items-center gap-1 text-ok">
              <IconCheck size={10} /> delivered <span className="normal-case">{formatDate(box.actualDelivery)}</span>
            </div>
          )}
        </div>

        {box.contents.length === 0 ? (
          <div className="text-[11px] text-text-tertiary italic">Empty box — nothing allocated yet.</div>
        ) : (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between text-[11px] text-text-secondary hover:text-text-primary py-1"
            >
              <span className="inline-flex items-center gap-1.5">
                {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                Contents · <span className="num-display font-medium text-text-primary">{formatNum(box.totalQty)}</span> units across{' '}
                <span className="num-display font-medium text-text-primary">{box.itemCount}</span> {box.itemCount === 1 ? 'line' : 'lines'}
              </span>
            </button>

            {expanded && (
              <div className="mt-2 flex flex-col gap-2">
                {box.contents.map((c) => (
                  <BoxContentRow key={c.shipmentItemId} item={c} readOnly={readOnly} />
                ))}
              </div>
            )}
          </>
        )}

        {box.notes && (
          <div className="mt-3 pt-3 border-t border-white/[0.04] text-[11px] text-text-tertiary italic">
            "{box.notes}"
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function BoxContentRow({
  item,
  readOnly,
}: {
  item: {
    shipmentItemId: string;
    orderId: string;
    sku: string;
    productName: string | null;
    imageUrl: string | null;
    qty: number;
  };
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleRemove = () => {
    if (!confirm(`Remove ${item.qty} × ${item.sku} from this box?`)) return;
    startTransition(async () => {
      await deleteShipmentItem(item.shipmentItemId);
      router.refresh();
    });
  };

  return (
    <div className="group flex items-center gap-3 p-2 rounded-md hover:bg-white/[0.02]">
      <div className="w-9 h-9 rounded-md bg-white/[0.025] border border-white/[0.05] overflow-hidden flex items-center justify-center shrink-0">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.productName ?? ''} className="w-full h-full object-cover" />
        ) : (
          <IconBox size={14} className="text-text-tertiary" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-mono text-accent">{item.sku}</span>
          <span className="text-text-tertiary">·</span>
          <Link
            href={`/orders/${item.orderId}`}
            className="text-text-secondary hover:text-accent hover:underline"
          >
            {item.orderId}
          </Link>
        </div>
        <div className="text-[11px] text-text-tertiary truncate">{item.productName ?? '—'}</div>
      </div>

      <div className="text-[13px] font-semibold num-display text-text-primary shrink-0">
        {formatNum(item.qty)}
      </div>

      {!readOnly && (
        <button
          onClick={handleRemove}
          disabled={pending}
          className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-bad p-1"
          title="Remove from box"
        >
          <IconX size={12} />
        </button>
      )}
    </div>
  );
}

function BoxEditor({ box, onClose }: { box: ShipmentBox; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [carrier, setCarrier] = useState(box.carrier ?? DEFAULT_CARRIER);
  const [tracking, setTracking] = useState(box.trackingNumber ?? '');
  const [status, setStatus] = useState<string>(normalizeShipmentStatus(box.status));
  const [shipDate, setShipDate] = useState(box.shipDate ?? '');
  const [eta, setEta] = useState(box.eta ?? '');
  const [delivered, setDelivered] = useState(box.actualDelivery ?? '');
  const [notes, setNotes] = useState(box.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        const ops: Promise<any>[] = [];
        if (carrier !== (box.carrier ?? '')) ops.push(updateShipment(box.id, 'carrier', carrier));
        if (tracking !== (box.trackingNumber ?? '')) ops.push(updateShipment(box.id, 'trackingNumber', tracking));
        if (status !== normalizeShipmentStatus(box.status)) ops.push(updateShipment(box.id, 'status', status));
        if (shipDate !== (box.shipDate ?? '')) ops.push(updateShipment(box.id, 'shipDate', shipDate));
        if (eta !== (box.eta ?? '')) ops.push(updateShipment(box.id, 'eta', eta));
        if (delivered !== (box.actualDelivery ?? '')) ops.push(updateShipment(box.id, 'actualDelivery', delivered));
        if (notes !== (box.notes ?? '')) ops.push(updateShipment(box.id, 'notes', notes));
        await Promise.all(ops);
        onClose();
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Failed to save');
      }
    });
  };

  return (
    <div className="px-4 py-4 bg-white/[0.02] border-b border-white/[0.04]">
      <div className="text-[10px] uppercase tracking-wider text-accent mb-3 inline-flex items-center gap-1.5 font-medium">
        <IconEdit size={11} /> Editing box {box.id}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Carrier">
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="sheet-input text-[12px]">
            {CARRIERS.map((c) => (
              <option key={c} value={c} className="bg-bg-base">{c}</option>
            ))}
            {box.carrier && !CARRIERS.includes(box.carrier as any) && (
              <option value={box.carrier} className="bg-bg-base">{box.carrier} (legacy)</option>
            )}
          </select>
        </Field>
        <Field label="Tracking #" hint={tracking && status === 'preparing' ? 'will auto-mark as shipped' : undefined}>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="paste tracking…"
            className="sheet-input font-mono text-[12px]"
          />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="sheet-input text-[12px]">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-bg-base">{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Shipped">
          <input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className="sheet-input text-[12px]" />
        </Field>
        <Field label="ETA">
          <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className="sheet-input text-[12px]" />
        </Field>
        <Field label="Delivered">
          <input type="date" value={delivered} onChange={(e) => setDelivered(e.target.value)} className="sheet-input text-[12px]" />
        </Field>
        <div className="col-span-2">
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything about this box…"
              className="sheet-input text-[12px] resize-none"
            />
          </Field>
        </div>
      </div>
      {error && <div className="text-[11px] text-bad mb-2">{error}</div>}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} disabled={pending} className="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="px-3 py-1.5 text-[12px] font-medium bg-accent/90 hover:bg-accent text-white rounded-md disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending ? <IconLoader2 size={13} className="animate-spin" /> : <IconCheck size={13} />}
          Save
        </button>
      </div>
    </div>
  );
}

function NewBoxForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [carrier, setCarrier] = useState<string>(DEFAULT_CARRIER);
  const [tracking, setTracking] = useState('');
  const [shipDate, setShipDate] = useState('');
  const [eta, setEta] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        await createEmptyShipment({
          carrier,
          trackingNumber: tracking || undefined,
          shipDate: shipDate || undefined,
          eta: eta || undefined,
          notes: notes || undefined,
        });
        onClose();
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Failed to create');
      }
    });
  };

  return (
    <GlassCard className="p-4 border-accent/30">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider text-accent inline-flex items-center gap-1.5 font-medium">
          <IconPackage size={11} /> New shipment box
        </div>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
          <IconX size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Carrier">
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="sheet-input text-[12px]">
            {CARRIERS.map((c) => (
              <option key={c} value={c} className="bg-bg-base">{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Tracking #" hint={tracking ? 'box will start as Shipped' : 'leave blank to start as Preparing'}>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="optional"
            className="sheet-input font-mono text-[12px]"
          />
        </Field>
        <Field label="Shipped">
          <input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className="sheet-input text-[12px]" />
        </Field>
        <Field label="ETA">
          <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className="sheet-input text-[12px]" />
        </Field>
        <div className="col-span-2">
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="optional — what's special about this box"
              className="sheet-input text-[12px] resize-none"
            />
          </Field>
        </div>
      </div>
      {error && <div className="text-[11px] text-bad mb-2">{error}</div>}
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={pending}
          className="px-3 py-1.5 text-[12px] font-medium bg-accent/90 hover:bg-accent text-white rounded-md disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending ? <IconLoader2 size={13} className="animate-spin" /> : <IconTruck size={13} />}
          Create box
        </button>
      </div>
    </GlassCard>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-[9px] uppercase tracking-wider text-text-tertiary">{label}</label>
        {hint && <span className="text-[9px] text-warn">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
