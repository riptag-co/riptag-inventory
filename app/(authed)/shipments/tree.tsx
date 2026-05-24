'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconChevronDown,
  IconChevronRight,
  IconPlus,
  IconLoader2,
  IconX,
  IconCalendar,
  IconTruck,
  IconPackage,
  IconBox,
  IconCash,
  IconEdit,
  IconCheck,
  IconArrowsExchange,
} from '@tabler/icons-react';
import { GlassCard } from '@/components/ui';
import {
  cn,
  formatDate,
  formatNum,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_CHOICES,
  normalizeShipmentStatus,
  rollupShipmentStage,
  STAGE_LABELS,
  statusVariant,
  type ShipmentStageStatus,
} from '@/lib/utils';
import {
  shipSome,
  updateShipment,
  deleteShipmentItem,
  updateShipmentItem,
  moveShipmentItem,
} from '@/app/actions';
import type { OrderBranch, OrderBranchItem, OrderBranchShipment } from '@/lib/db/queries';

const STATUS_OPTIONS = SHIPMENT_STATUS_CHOICES.map((value) => ({
  value,
  label: value === 'preparing' ? 'Preparing' : value === 'shipped' ? 'Shipped' : 'Delivered',
}));

const CARRIER_OPTIONS = ['UPS', 'DHL', 'FedEx', 'USPS', 'SF Express', 'Other'];

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

function StagePill({ stage, label }: { stage: string; label?: string }) {
  const cls = variantClasses(statusVariant(stage));
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border', cls.text, cls.bg, cls.border)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cls.dot)} />
      {label ?? stage}
    </span>
  );
}

export function ShipmentsTree({
  orders,
  existingShipments,
  readOnly,
  isOwner,
}: {
  orders: OrderBranch[];
  existingShipments: { id: string; carrier: string | null; trackingNumber: string | null; status: string }[];
  readOnly: boolean;
  isOwner: boolean;
}) {
  const [showUnpaid, setShowUnpaid] = useState(false);
  const paid = orders.filter((o) => o.paid);
  const unpaid = orders.filter((o) => !o.paid);

  if (orders.length === 0) {
    return <div className="text-text-tertiary text-center py-12 text-sm">No orders yet.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {paid.length === 0 && (
        <div className="glass p-6 text-center">
          <IconCash size={28} className="mx-auto text-text-tertiary mb-2" />
          <div className="text-[14px] font-medium text-text-secondary">No paid orders yet</div>
          <div className="text-[12px] text-text-tertiary mt-1">
            {isOwner
              ? 'Mark an order as paid to start tracking shipments here.'
              : 'Waiting on payment confirmation.'}
          </div>
        </div>
      )}

      {paid.length > 0 && (
        <div className="flex flex-col gap-4">
          {paid.map((order) => (
            <OrderBranchCard
              key={order.orderId}
              order={order}
              existingShipments={existingShipments}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      {isOwner && unpaid.length > 0 && (
        <div>
          <button
            onClick={() => setShowUnpaid(!showUnpaid)}
            className="w-full flex items-center justify-between px-4 py-3 text-[12px] text-text-tertiary hover:text-text-secondary border-t border-white/[0.06]"
          >
            <span className="inline-flex items-center gap-2">
              {showUnpaid ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <span className="uppercase tracking-wider font-medium">Awaiting payment ({unpaid.length})</span>
            </span>
            <span className="text-[11px] text-text-tertiary">
              {showUnpaid ? 'Hide' : 'Show'} — supplier doesn't ship until paid
            </span>
          </button>
          {showUnpaid && (
            <div className="flex flex-col gap-4 mt-3 opacity-60">
              {unpaid.map((order) => (
                <OrderBranchCard
                  key={order.orderId}
                  order={order}
                  existingShipments={existingShipments}
                  readOnly
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrderBranchCard({
  order,
  existingShipments,
  readOnly,
}: {
  order: OrderBranch;
  existingShipments: { id: string; carrier: string | null; trackingNumber: string | null; status: string }[];
  readOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const totalOrdered = order.items.reduce((s, i) => s + i.qtyOrdered, 0);
  const totalShipped = order.items.reduce((s, i) => s + i.qtyShipped, 0);

  const allShipStatuses = order.items.flatMap((i) => i.shipments.map((s) => s.status));
  const everythingAllocated = order.items.every((i) => i.qtyShipped >= i.qtyOrdered);
  const baseStage: ShipmentStageStatus = totalShipped === 0
    ? 'not_started'
    : rollupShipmentStage(allShipStatuses);

  const displayStage: ShipmentStageStatus = totalShipped === 0
    ? 'not_started'
    : !everythingAllocated && baseStage === 'all_delivered'
    ? 'shipped'
    : baseStage;

  return (
    <GlassCard className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <IconChevronDown size={16} className="text-text-tertiary" />
          ) : (
            <IconChevronRight size={16} className="text-text-tertiary" />
          )}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[15px] text-text-primary">{order.orderId}</span>
              <span className="text-text-tertiary text-[12px]">·</span>
              <span className="text-[12px] text-text-secondary">{formatDate(order.orderDate)}</span>
            </div>
            <div className="text-[11px] text-text-tertiary mt-0.5">
              {order.items.length} {order.items.length === 1 ? 'item' : 'items'} ·{' '}
              <span className="num-display">{formatNum(totalShipped)}</span> of{' '}
              <span className="num-display">{formatNum(totalOrdered)}</span> units allocated
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StagePill stage={order.paid ? 'paid' : 'pending_payment'} label={order.paid ? 'paid' : 'unpaid'} />
          <StagePill stage={displayStage} label={STAGE_LABELS[displayStage] ?? displayStage} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.04] divide-y divide-white/[0.04]">
          {order.items.map((item) => (
            <ItemBranch
              key={item.orderItemId}
              orderId={order.orderId}
              item={item}
              existingShipments={existingShipments}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function ItemBranch({
  orderId,
  item,
  existingShipments,
  readOnly,
}: {
  orderId: string;
  item: OrderBranchItem;
  existingShipments: { id: string; carrier: string | null; trackingNumber: string | null; status: string }[];
  readOnly: boolean;
}) {
  const [showShipForm, setShowShipForm] = useState(false);
  const pct = item.qtyOrdered === 0 ? 0 : Math.min(100, (item.qtyShipped / item.qtyOrdered) * 100);
  const allShipped = item.qtyRemaining <= 0;
  const itemStage = rollupShipmentStage(item.shipments.map((s) => s.status));

  const barColor = !allShipped
    ? 'bg-warn'
    : itemStage === 'all_delivered'
    ? 'bg-ok'
    : itemStage === 'shipped'
    ? 'bg-info'
    : 'bg-warn';

  return (
    <div className="px-5 py-4 grid grid-cols-[80px_1fr] gap-4">
      <div className="aspect-square rounded-lg bg-white/[0.025] border border-white/[0.05] overflow-hidden flex items-center justify-center">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.productName ?? ''} className="w-full h-full object-cover" />
        ) : (
          <IconBox size={22} className="text-text-tertiary" strokeWidth={1.5} />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-text-primary truncate">
              {item.productName ?? <span className="text-text-tertiary">Unknown product</span>}
            </div>
            <div className="text-[11px] font-mono text-accent mt-0.5">{item.sku}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[12px] text-text-secondary">
              <span className="num-display font-medium">{formatNum(item.qtyShipped)}</span>
              <span className="text-text-tertiary"> / </span>
              <span className="num-display">{formatNum(item.qtyOrdered)}</span>
            </div>
            {item.qtyRemaining > 0 ? (
              <div className="text-[10px] text-warn mt-0.5">
                <span className="num-display font-medium">{formatNum(item.qtyRemaining)}</span> still in production
              </div>
            ) : (
              <div className={cn('text-[10px] mt-0.5', itemStage === 'all_delivered' ? 'text-ok' : 'text-info')}>
                {itemStage === 'all_delivered' ? 'all delivered ✓' : 'allocated'}
              </div>
            )}
          </div>
        </div>

        <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mb-3">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex flex-col gap-1">
          {item.shipments.length === 0 && !showShipForm && (
            <div className="text-[11px] text-text-tertiary italic py-1">No shipments yet.</div>
          )}
          {item.shipments.map((s, idx) => (
            <AllocationRow
              key={s.shipmentItemId}
              shipment={s}
              isLast={idx === item.shipments.length - 1 && !showShipForm}
              readOnly={readOnly}
              existingShipments={existingShipments}
            />
          ))}

          {showShipForm && !readOnly && (
            <ShipSomeForm
              orderItemId={item.orderItemId}
              maxQty={item.qtyRemaining > 0 ? item.qtyRemaining : item.qtyOrdered}
              existingShipments={existingShipments}
              onClose={() => setShowShipForm(false)}
            />
          )}

          {!showShipForm && !readOnly && (
            <button
              onClick={() => setShowShipForm(true)}
              className="self-start mt-2 flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-accent transition-colors px-2 py-1 -ml-2 rounded-md hover:bg-white/[0.03]"
            >
              <IconPlus size={13} strokeWidth={2} />
              Ship some
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AllocationRow({
  shipment,
  isLast,
  readOnly,
  existingShipments,
}: {
  shipment: OrderBranchShipment;
  isLast: boolean;
  readOnly: boolean;
  existingShipments: { id: string; carrier: string | null; trackingNumber: string | null; status: string }[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="relative pl-5 py-1.5 group">
      <span
        className={cn('absolute left-0 top-0 w-px bg-white/[0.08]', isLast && !editing ? 'h-[18px]' : 'bottom-0')}
      />
      <span className="absolute left-0 top-[18px] w-3 h-px bg-white/[0.08]" />

      {!editing ? (
        <AllocationView
          shipment={shipment}
          readOnly={readOnly}
          onEdit={() => setEditing(true)}
        />
      ) : (
        <AllocationEditor
          shipment={shipment}
          existingShipments={existingShipments}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function AllocationView({
  shipment,
  readOnly,
  onEdit,
}: {
  shipment: OrderBranchShipment;
  readOnly: boolean;
  onEdit: () => void;
}) {
  const normalizedStatus = normalizeShipmentStatus(shipment.status);
  const cls = variantClasses(statusVariant(normalizedStatus));

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[11px] font-mono text-text-primary font-medium">{shipment.shipmentId}</span>

      <span className="text-[12px] num-display font-medium text-text-primary">
        {formatNum(shipment.qty)} units
      </span>

      <span className="text-text-tertiary text-[11px]">·</span>

      <span className="text-[11px] text-text-secondary">
        {shipment.carrier ?? <span className="italic text-text-tertiary">no carrier</span>}
      </span>

      <span className="font-mono text-[11px] text-text-tertiary truncate max-w-[200px]">
        {shipment.trackingNumber ?? <span className="italic">no tracking</span>}
      </span>

      <span
        className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border', cls.text, cls.bg, cls.border)}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', cls.dot)} />
        {normalizedStatus === 'preparing' ? 'Preparing' : normalizedStatus === 'shipped' ? 'Shipped' : 'Delivered'}
      </span>

      {shipment.eta && normalizedStatus !== 'delivered' && (
        <span className="text-[10px] text-text-tertiary inline-flex items-center gap-1">
          <IconCalendar size={10} /> ETA {formatDate(shipment.eta)}
        </span>
      )}

      {shipment.actualDelivery && normalizedStatus === 'delivered' && (
        <span className="text-[10px] text-ok inline-flex items-center gap-1">
          <IconCheck size={10} /> delivered {formatDate(shipment.actualDelivery)}
        </span>
      )}

      {!readOnly && (
        <button
          onClick={onEdit}
          className="ml-auto flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-primary px-1.5 py-0.5 rounded hover:bg-white/[0.04]"
          title="Edit this allocation"
        >
          <IconEdit size={11} />
          Edit
        </button>
      )}
    </div>
  );
}

function AllocationEditor({
  shipment,
  existingShipments,
  onClose,
}: {
  shipment: OrderBranchShipment;
  existingShipments: { id: string; carrier: string | null; trackingNumber: string | null; status: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [qty, setQty] = useState(String(shipment.qty));
  const [shipmentId, setShipmentId] = useState(shipment.shipmentId);
  const [carrier, setCarrier] = useState(shipment.carrier ?? 'UPS');
  const [tracking, setTracking] = useState(shipment.trackingNumber ?? '');
  const [status, setStatus] = useState<string>(normalizeShipmentStatus(shipment.status));
  const [shipDate, setShipDate] = useState(shipment.shipDate ?? '');
  const [eta, setEta] = useState(shipment.eta ?? '');
  const [delivered, setDelivered] = useState(shipment.actualDelivery ?? '');
  const [notes, setNotes] = useState(shipment.notes ?? '');

  const remove = () => {
    if (!confirm(`Remove ${shipment.qty} units from ${shipment.shipmentId}?`)) return;
    startTransition(async () => {
      await deleteShipmentItem(shipment.shipmentItemId);
      onClose();
      router.refresh();
    });
  };

  const save = () => {
    setError(null);
    const newQty = parseInt(qty, 10);
    if (isNaN(newQty) || newQty <= 0) {
      setError('Quantity must be a positive number');
      return;
    }

    startTransition(async () => {
      try {
        // Move first (changes which box we then edit shipment-level fields on)
        if (shipmentId !== shipment.shipmentId) {
          await moveShipmentItem(shipment.shipmentItemId, shipmentId);
        }

        // Qty (allocation-level)
        if (newQty !== shipment.qty) {
          await updateShipmentItem(shipment.shipmentItemId, 'qty', newQty);
        }

        // Apply shipment-level changes to the (possibly new) target shipment
        const ops: Promise<any>[] = [];
        if (carrier !== (shipment.carrier ?? '') && carrier) {
          ops.push(updateShipment(shipmentId, 'carrier', carrier));
        }
        if (tracking !== (shipment.trackingNumber ?? '')) {
          ops.push(updateShipment(shipmentId, 'trackingNumber', tracking));
        }
        // Push status LAST so server-side auto-bump on tracking doesn't get overridden
        const currentNormalized = normalizeShipmentStatus(shipment.status);
        if (status !== currentNormalized) {
          ops.push(updateShipment(shipmentId, 'status', status));
        }
        if (shipDate !== (shipment.shipDate ?? '')) {
          ops.push(updateShipment(shipmentId, 'shipDate', shipDate));
        }
        if (eta !== (shipment.eta ?? '')) {
          ops.push(updateShipment(shipmentId, 'eta', eta));
        }
        if (delivered !== (shipment.actualDelivery ?? '')) {
          ops.push(updateShipment(shipmentId, 'actualDelivery', delivered));
        }
        if (notes !== (shipment.notes ?? '')) {
          ops.push(updateShipment(shipmentId, 'notes', notes));
        }

        await Promise.all(ops);
        onClose();
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Failed to save');
      }
    });
  };

  const boxChanged = shipmentId !== shipment.shipmentId;

  return (
    <div className="mt-1 rounded-lg bg-white/[0.025] border border-accent/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider font-medium text-accent inline-flex items-center gap-1.5">
          <IconEdit size={11} /> Editing allocation
        </div>
        <button
          onClick={onClose}
          className="text-text-tertiary hover:text-text-primary"
          aria-label="Cancel"
        >
          <IconX size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Field label="Units">
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="sheet-input num-display text-[13px] font-medium"
          />
        </Field>
        <Field label="Shipment box" hint={boxChanged ? '⚠️ moving to a different box' : undefined}>
          <select
            value={shipmentId}
            onChange={(e) => setShipmentId(e.target.value)}
            className={cn(
              'sheet-input text-[12px]',
              boxChanged && 'border-warn/40 bg-warn/[0.04]'
            )}
          >
            {existingShipments.map((s) => (
              <option key={s.id} value={s.id} className="bg-bg-base">
                {s.id}
                {s.carrier ? ` — ${s.carrier}` : ''}
                {s.trackingNumber ? ` · ${s.trackingNumber.slice(-8)}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="border-t border-white/[0.06] pt-3 mb-3">
        <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-2 inline-flex items-center gap-1.5">
          <IconArrowsExchange size={10} /> Box details (shared with all items in {shipmentId})
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Carrier">
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="sheet-input text-[12px]"
            >
              {CARRIER_OPTIONS.map((c) => (
                <option key={c} value={c} className="bg-bg-base">{c}</option>
              ))}
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
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="sheet-input text-[12px]"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-bg-base">{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Shipped date">
            <input
              type="date"
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
              className="sheet-input text-[12px]"
            />
          </Field>

          <Field label="ETA">
            <input
              type="date"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="sheet-input text-[12px]"
            />
          </Field>

          <Field label="Delivered on">
            <input
              type="date"
              value={delivered}
              onChange={(e) => setDelivered(e.target.value)}
              className="sheet-input text-[12px]"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="sheet-input text-[12px] resize-none"
                placeholder="Anything about this box…"
              />
            </Field>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[11px] text-bad mb-3">{error}</div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={remove}
          disabled={pending}
          className="text-[12px] text-text-tertiary hover:text-bad inline-flex items-center gap-1.5 px-2 py-1 rounded"
        >
          <IconX size={12} /> Remove allocation
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="px-3 py-1.5 text-[12px] font-medium bg-accent/90 hover:bg-accent text-white rounded-md disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {pending ? <IconLoader2 size={13} className="animate-spin" /> : <IconCheck size={13} />}
            Save changes
          </button>
        </div>
      </div>
    </div>
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

function ShipSomeForm({
  orderItemId,
  maxQty,
  existingShipments,
  onClose,
}: {
  orderItemId: string;
  maxQty: number;
  existingShipments: { id: string; carrier: string | null; trackingNumber: string | null; status: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'new' | 'existing'>(existingShipments.length > 0 ? 'existing' : 'new');
  const [qty, setQty] = useState(String(maxQty > 0 ? maxQty : ''));
  const [shipmentId, setShipmentId] = useState(existingShipments[0]?.id ?? '');
  const [carrier, setCarrier] = useState('UPS');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipDate, setShipDate] = useState(new Date().toISOString().slice(0, 10));
  const [eta, setEta] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const n = parseInt(qty, 10);
    if (isNaN(n) || n <= 0) {
      setError('Enter a valid quantity');
      return;
    }
    startTransition(async () => {
      try {
        if (mode === 'existing') {
          if (!shipmentId) {
            setError('Pick a shipment');
            return;
          }
          await shipSome(orderItemId, n, { type: 'existing', shipmentId });
        } else {
          await shipSome(orderItemId, n, {
            type: 'new',
            carrier: carrier || undefined,
            trackingNumber: trackingNumber || undefined,
            shipDate: shipDate || undefined,
            eta: eta || undefined,
          });
        }
        onClose();
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Failed to allocate');
      }
    });
  };

  return (
    <div className="relative pl-5 py-3 my-1 rounded-lg bg-white/[0.02] border border-white/[0.06]">
      <span className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.08]" />
      <span className="absolute left-0 top-[26px] w-3 h-px bg-white/[0.08]" />

      <div className="px-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Ship some units</div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <IconX size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('new')}
            className={cn(
              'px-3 py-1 text-[11px] font-medium rounded-md border transition',
              mode === 'new'
                ? 'bg-accent/20 border-accent/40 text-accent'
                : 'bg-transparent border-white/[0.08] text-text-secondary hover:border-white/[0.16]'
            )}
          >
            <IconPlus size={11} className="inline -mt-0.5 mr-1" />
            New shipment
          </button>
          <button
            onClick={() => setMode('existing')}
            disabled={existingShipments.length === 0}
            className={cn(
              'px-3 py-1 text-[11px] font-medium rounded-md border transition disabled:opacity-30',
              mode === 'existing'
                ? 'bg-accent/20 border-accent/40 text-accent'
                : 'bg-transparent border-white/[0.08] text-text-secondary hover:border-white/[0.16]'
            )}
          >
            <IconPackage size={11} className="inline -mt-0.5 mr-1" />
            Existing box
          </button>
        </div>

        <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
          <label className="text-[11px] text-text-secondary">Quantity</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={`max ${maxQty}`}
            className="sheet-input num-display text-[13px] font-medium"
          />

          {mode === 'existing' && (
            <>
              <label className="text-[11px] text-text-secondary">Box</label>
              <select
                value={shipmentId}
                onChange={(e) => setShipmentId(e.target.value)}
                className="sheet-input text-[12px]"
              >
                {existingShipments.map((s) => (
                  <option key={s.id} value={s.id} className="bg-bg-base">
                    {s.id} — {s.carrier ?? 'no carrier'} {s.trackingNumber ? `· ${s.trackingNumber.slice(-8)}` : ''}
                  </option>
                ))}
              </select>
            </>
          )}

          {mode === 'new' && (
            <>
              <label className="text-[11px] text-text-secondary">Carrier</label>
              <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="sheet-input text-[12px]">
                {CARRIER_OPTIONS.map((c) => (
                  <option key={c} value={c} className="bg-bg-base">
                    {c}
                  </option>
                ))}
              </select>

              <label className="text-[11px] text-text-secondary">Tracking #</label>
              <input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="optional"
                className="sheet-input font-mono text-[12px]"
              />

              <label className="text-[11px] text-text-secondary">Shipped</label>
              <input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className="sheet-input text-[12px]" />

              <label className="text-[11px] text-text-secondary">ETA</label>
              <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className="sheet-input text-[12px]" />
            </>
          )}
        </div>

        {error && <div className="text-[11px] text-bad">{error}</div>}

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-3 py-1.5 text-[12px] font-medium bg-accent/90 hover:bg-accent text-white rounded-md disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {pending ? <IconLoader2 size={13} className="animate-spin" /> : <IconTruck size={13} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
