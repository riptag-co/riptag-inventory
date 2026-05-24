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
  createEmptyShipment,
} from '@/app/actions';
import type { OrderBranch, OrderBranchItem, OrderBranchShipment } from '@/lib/db/queries';
import { CARRIERS, DEFAULT_CARRIER } from '@/lib/utils';
import { TrackingLink } from './boxes';

const STATUS_OPTIONS = SHIPMENT_STATUS_CHOICES.map((value) => ({
  value,
  label: value === 'preparing' ? 'Preparing' : value === 'shipped' ? 'Shipped' : 'Delivered',
}));

const CARRIER_OPTIONS = [...CARRIERS];

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qtyEditing, setQtyEditing] = useState(false);
  const [qty, setQty] = useState(String(shipment.qty));
  const [trackingEditing, setTrackingEditing] = useState(false);
  const [tracking, setTracking] = useState(shipment.trackingNumber ?? '');
  const normalizedStatus = normalizeShipmentStatus(shipment.status);

  const saveQty = () => {
    setQtyEditing(false);
    const n = parseInt(qty, 10);
    if (isNaN(n) || n === shipment.qty) return;
    startTransition(async () => {
      await updateShipmentItem(shipment.shipmentItemId, 'qty', n);
      router.refresh();
    });
  };

  const saveTracking = () => {
    setTrackingEditing(false);
    if (tracking === (shipment.trackingNumber ?? '')) return;
    startTransition(async () => {
      await updateShipment(shipment.shipmentId, 'trackingNumber', tracking);
      router.refresh();
    });
  };

  const updateStatus = (newStatus: string) => {
    startTransition(async () => {
      await updateShipment(shipment.shipmentId, 'status', newStatus);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <span className="text-[11px] font-mono text-text-primary font-medium">{shipment.shipmentId}</span>

      {qtyEditing && !readOnly ? (
        <input
          autoFocus
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={saveQty}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setQty(String(shipment.qty));
              setQtyEditing(false);
            }
          }}
          className="sheet-input w-16 text-[12px] num-display font-medium"
        />
      ) : (
        <button
          disabled={readOnly}
          onClick={() => !readOnly && setQtyEditing(true)}
          className={cn(
            'text-[12px] num-display font-medium text-text-primary px-1.5 py-0.5 -mx-1.5 rounded',
            !readOnly && 'hover:bg-white/[0.04] cursor-text'
          )}
        >
          {formatNum(shipment.qty)} units
        </button>
      )}

      <span className="text-text-tertiary text-[11px]">·</span>

      <InlineStatusSelect
        value={normalizedStatus}
        onChange={updateStatus}
        disabled={readOnly || pending}
      />

      {trackingEditing && !readOnly ? (
        <input
          autoFocus
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          onBlur={saveTracking}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setTracking(shipment.trackingNumber ?? '');
              setTrackingEditing(false);
            }
          }}
          placeholder="tracking #"
          className="sheet-input font-mono text-[11px] w-48"
        />
      ) : shipment.trackingNumber ? (
        <TrackingLink carrier={shipment.carrier} trackingNumber={shipment.trackingNumber} className="truncate max-w-[200px]" />
      ) : !readOnly ? (
        <button
          onClick={() => setTrackingEditing(true)}
          className="text-[11px] text-text-tertiary italic hover:text-text-secondary px-1.5 py-0.5 -mx-1.5 rounded hover:bg-white/[0.04] cursor-text"
        >
          + add tracking
        </button>
      ) : (
        <span className="text-[11px] italic text-text-tertiary">no tracking</span>
      )}

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
          title="Edit ETA, move to another box, or add notes"
        >
          <IconEdit size={11} />
          More
        </button>
      )}
    </div>
  );
}

function InlineStatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const cls = variantClasses(statusVariant(value));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer transition appearance-none pr-6 bg-no-repeat',
        cls.text,
        cls.bg,
        cls.border
      )}
      style={{
        backgroundImage:
          'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2.5\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
        backgroundPosition: 'right 6px center',
        backgroundSize: '10px',
      }}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value} className="bg-bg-base text-text-primary">
          {o.label}
        </option>
      ))}
    </select>
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

  const [shipmentId, setShipmentId] = useState(shipment.shipmentId);
  const [eta, setEta] = useState(shipment.eta ?? '');
  const [notes, setNotes] = useState(shipment.notes ?? '');
  const [creatingNewBox, setCreatingNewBox] = useState(false);

  const handleBoxSelect = (val: string) => {
    if (val === '__NEW__') {
      setCreatingNewBox(true);
    } else {
      setShipmentId(val);
    }
  };

  const handleNewBoxCreated = (newId: string) => {
    setCreatingNewBox(false);
    setShipmentId(newId);
  };

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

    startTransition(async () => {
      try {
        if (shipmentId !== shipment.shipmentId) {
          await moveShipmentItem(shipment.shipmentItemId, shipmentId);
        }

        const ops: Promise<any>[] = [];
        if (eta !== (shipment.eta ?? '')) {
          ops.push(updateShipment(shipmentId, 'eta', eta));
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
          <IconEdit size={11} /> More details
        </div>
        <button
          onClick={onClose}
          className="text-text-tertiary hover:text-text-primary"
          aria-label="Cancel"
        >
          <IconX size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Move to box" hint={boxChanged ? '⚠️ moving' : undefined}>
          <select
            value={shipmentId}
            onChange={(e) => handleBoxSelect(e.target.value)}
            className={cn(
              'sheet-input text-[12px]',
              boxChanged && 'border-warn/40 bg-warn/[0.04]'
            )}
          >
            {existingShipments.map((s) => (
              <option key={s.id} value={s.id} className="bg-bg-base">
                {s.id}
                {s.trackingNumber ? ` · ${s.trackingNumber.slice(-8)}` : ''}
              </option>
            ))}
            <option value="__NEW__" className="bg-bg-base text-accent">+ Create a new box…</option>
          </select>
        </Field>

        <Field label="ETA (rough estimate)">
          <input
            type="date"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="sheet-input text-[12px]"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Notes (shared with all items in this box)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="sheet-input text-[12px] resize-none"
              placeholder="Anything to remember about this box…"
            />
          </Field>
        </div>
      </div>

      {creatingNewBox && (
        <InlineNewBox onCreated={handleNewBoxCreated} onCancel={() => setCreatingNewBox(false)} />
      )}

      {error && (
        <div className="text-[11px] text-bad mb-3">{error}</div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={remove}
          disabled={pending}
          className="text-[12px] text-text-tertiary hover:text-bad inline-flex items-center gap-1.5 px-2 py-1 rounded"
        >
          <IconX size={12} /> Remove this allocation
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
            Save
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

function InlineNewBox({
  onCreated,
  onCancel,
}: {
  onCreated: (newId: string) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [carrier, setCarrier] = useState<string>(DEFAULT_CARRIER);
  const [tracking, setTracking] = useState('');
  const [eta, setEta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    setError(null);
    startTransition(async () => {
      try {
        const newId = await createEmptyShipment({
          carrier,
          trackingNumber: tracking || undefined,
          eta: eta || undefined,
        });
        router.refresh();
        onCreated(newId);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to create');
      }
    });
  };

  return (
    <div className="mt-3 mb-3 p-3 rounded-md bg-accent/[0.04] border border-accent/30">
      <div className="text-[10px] uppercase tracking-wider text-accent mb-2 font-medium inline-flex items-center gap-1.5">
        <IconPackage size={11} /> New box
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Field label="Carrier">
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="sheet-input text-[12px]">
            {CARRIER_OPTIONS.map((c) => (
              <option key={c} value={c} className="bg-bg-base">{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Tracking #">
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="optional"
            className="sheet-input font-mono text-[12px]"
          />
        </Field>
        <Field label="ETA">
          <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className="sheet-input text-[12px]" />
        </Field>
      </div>
      {error && <div className="text-[11px] text-bad mb-2">{error}</div>}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary">
          Cancel
        </button>
        <button
          onClick={create}
          disabled={pending}
          className="px-2.5 py-1 text-[11px] font-medium bg-accent/90 hover:bg-accent text-white rounded-md disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending ? <IconLoader2 size={11} className="animate-spin" /> : <IconPackage size={11} />}
          Create and use
        </button>
      </div>
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
  const [carrier, setCarrier] = useState<string>(DEFAULT_CARRIER);
  const [trackingNumber, setTrackingNumber] = useState('');
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
