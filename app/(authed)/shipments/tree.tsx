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
} from '@tabler/icons-react';
import { GlassCard, StatusPill } from '@/components/ui';
import { cn, formatDate, formatNum, SHIPMENT_STATUS_LABELS } from '@/lib/utils';
import {
  shipSome,
  updateShipment,
  deleteShipmentItem,
  updateShipmentItem,
} from '@/app/actions';
import type { OrderBranch, OrderBranchItem, OrderBranchShipment } from '@/lib/db/queries';

const SHIPMENT_STATUS_OPTIONS = Object.entries(SHIPMENT_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function ShipmentsTree({
  orders,
  existingShipments,
  readOnly,
}: {
  orders: OrderBranch[];
  existingShipments: { id: string; carrier: string | null; trackingNumber: string | null; status: string }[];
  readOnly: boolean;
}) {
  if (orders.length === 0) {
    return <div className="text-text-tertiary text-center py-12 text-sm">No orders yet.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((order) => (
        <OrderBranchCard
          key={order.orderId}
          order={order}
          existingShipments={existingShipments}
          readOnly={readOnly}
        />
      ))}
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
  const allComplete = totalShipped >= totalOrdered;

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
              <span className="num-display">{formatNum(totalOrdered)}</span> units shipped
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {order.paid ? (
            <StatusPill status="ok" label="paid" />
          ) : (
            <StatusPill status="bad" label="unpaid" />
          )}
          {allComplete ? (
            <StatusPill status="ok" label="all shipped" />
          ) : (
            <StatusPill status="warn" label="in progress" />
          )}
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
                <span className="num-display font-medium">{formatNum(item.qtyRemaining)}</span> owed
              </div>
            ) : (
              <div className="text-[10px] text-ok mt-0.5">complete</div>
            )}
          </div>
        </div>

        <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mb-3">
          <div
            className={cn('h-full rounded-full transition-all', allShipped ? 'bg-ok' : 'bg-accent')}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex flex-col">
          {item.shipments.length === 0 && !showShipForm && (
            <div className="text-[11px] text-text-tertiary italic py-1">No shipments yet.</div>
          )}
          {item.shipments.map((s, idx) => (
            <ShipmentRow
              key={s.shipmentItemId}
              shipment={s}
              isLast={idx === item.shipments.length - 1 && !showShipForm}
              readOnly={readOnly}
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

function ShipmentRow({
  shipment,
  isLast,
  readOnly,
}: {
  shipment: OrderBranchShipment;
  isLast: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingQty, setEditingQty] = useState(false);
  const [qty, setQty] = useState(String(shipment.qty));
  const [editingTracking, setEditingTracking] = useState(false);
  const [tracking, setTracking] = useState(shipment.trackingNumber ?? '');

  const saveQty = () => {
    setEditingQty(false);
    const n = parseInt(qty, 10);
    if (isNaN(n) || n === shipment.qty) return;
    startTransition(async () => {
      await updateShipmentItem(shipment.shipmentItemId, 'qty', n);
      router.refresh();
    });
  };

  const saveTracking = () => {
    setEditingTracking(false);
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

  const removeAllocation = () => {
    if (!confirm(`Remove ${shipment.qty} units from ${shipment.shipmentId}?`)) return;
    startTransition(async () => {
      await deleteShipmentItem(shipment.shipmentItemId);
      router.refresh();
    });
  };

  return (
    <div className="relative pl-5 py-1.5 group">
      <span
        className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.08]"
        style={isLast ? { bottom: 'calc(100% - 18px)' } : undefined}
      />
      <span className="absolute left-0 top-[18px] w-3 h-px bg-white/[0.08]" />

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-mono text-text-primary font-medium">{shipment.shipmentId}</span>

        {editingQty && !readOnly ? (
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
                setEditingQty(false);
              }
            }}
            className="sheet-input w-16 text-[12px] num-display font-medium"
          />
        ) : (
          <button
            disabled={readOnly}
            onClick={() => !readOnly && setEditingQty(true)}
            className={cn(
              'text-[12px] num-display font-medium text-text-primary px-1.5 py-0.5 -mx-1.5 rounded',
              !readOnly && 'hover:bg-white/[0.04] cursor-text'
            )}
          >
            {formatNum(shipment.qty)} units
          </button>
        )}

        <span className="text-text-tertiary text-[11px]">·</span>

        <span className="text-[11px] text-text-secondary">{shipment.carrier ?? '—'}</span>

        {editingTracking && !readOnly ? (
          <input
            autoFocus
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            onBlur={saveTracking}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setTracking(shipment.trackingNumber ?? '');
                setEditingTracking(false);
              }
            }}
            placeholder="tracking #"
            className="sheet-input font-mono text-[11px] w-48"
          />
        ) : (
          <button
            disabled={readOnly}
            onClick={() => !readOnly && setEditingTracking(true)}
            className={cn(
              'font-mono text-[11px] text-text-tertiary px-1.5 py-0.5 -mx-1.5 rounded',
              !readOnly && 'hover:bg-white/[0.04] cursor-text'
            )}
          >
            {shipment.trackingNumber ?? <span className="italic">add tracking</span>}
          </button>
        )}

        {readOnly ? (
          <StatusPill status={shipment.status} label={SHIPMENT_STATUS_LABELS[shipment.status as keyof typeof SHIPMENT_STATUS_LABELS]} />
        ) : (
          <select
            value={shipment.status}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={pending}
            className="bg-transparent border border-white/[0.06] rounded-full px-2 py-0.5 text-[11px] text-text-secondary hover:bg-white/[0.04] cursor-pointer"
          >
            {SHIPMENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-bg-base">
                {o.label}
              </option>
            ))}
          </select>
        )}

        {shipment.eta && (
          <span className="text-[10px] text-text-tertiary inline-flex items-center gap-1">
            <IconCalendar size={10} /> ETA {formatDate(shipment.eta)}
          </span>
        )}

        {!readOnly && (
          <button
            onClick={removeAllocation}
            disabled={pending}
            className="ml-auto opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-bad transition"
            title="Remove this allocation"
          >
            <IconX size={13} />
          </button>
        )}
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
                    {s.id} — {s.carrier ?? 'no carrier'} {s.trackingNumber ? `· ${s.trackingNumber.slice(-8)}` : ''} ({s.status})
                  </option>
                ))}
              </select>
            </>
          )}

          {mode === 'new' && (
            <>
              <label className="text-[11px] text-text-secondary">Carrier</label>
              <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="sheet-input text-[12px]">
                {['UPS', 'DHL', 'FedEx', 'USPS', 'SF Express', 'Other'].map((c) => (
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
