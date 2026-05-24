import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db, orders, products, shipmentItems, shipments } from '@/lib/db';
import { getOrderItemsFull } from '@/lib/db/queries';
import { PageHeader, GlassCard, StatusPill, SectionTitle } from '@/components/ui';
import { formatUsd, formatNum, formatDate, ORDER_STATUS_LABELS, SHIPMENT_STATUS_LABELS } from '@/lib/utils';
import { OrderItemsTable } from './items-table';
import { IconArrowLeft } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orderRows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!orderRows.length) notFound();
  const order = orderRows[0];

  const items = await getOrderItemsFull(id);
  const allProducts = await db.select().from(products);

  const shipItemRows = await db
    .select({
      shipmentId: shipmentItems.shipmentId,
      sku: shipmentItems.sku,
      qty: shipmentItems.qty,
    })
    .from(shipmentItems)
    .where(eq(shipmentItems.orderId, id));

  const shipIds = Array.from(new Set(shipItemRows.map((r) => r.shipmentId)));
  const shipDetails =
    shipIds.length > 0
      ? await db.select().from(shipments).where(eq(shipments.id, shipIds[0]))
          .then(async (first) => {
            const rest = await Promise.all(
              shipIds.slice(1).map((sid) => db.select().from(shipments).where(eq(shipments.id, sid)))
            );
            return [...first, ...rest.flat()];
          })
      : [];

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const shipping = Number(order.shippingCost);
  const total = subtotal + shipping;

  const itemsByShipment = new Map<string, typeof items[0][]>();
  for (const item of items) {
    const lineShipments = shipItemRows.filter((s) => s.sku === item.sku);
    for (const ls of lineShipments) {
      if (!itemsByShipment.has(ls.shipmentId)) itemsByShipment.set(ls.shipmentId, []);
    }
  }

  return (
    <>
      <Link href="/orders" className="text-[12px] text-text-tertiary hover:text-text-secondary inline-flex items-center gap-1 mb-3">
        <IconArrowLeft size={12} /> All orders
      </Link>

      <PageHeader
        title={order.id}
        subtitle={`Ordered ${formatDate(order.orderDate)} · ${items.length} line items`}
        actions={<StatusPill status={order.status} label={ORDER_STATUS_LABELS[order.status]} />}
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <GlassCard className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Subtotal</div>
          <div className="num-display text-[22px] font-semibold mt-1.5">{formatUsd(subtotal)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Shipping</div>
          <div className="num-display text-[22px] font-semibold mt-1.5">{formatUsd(shipping)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Total</div>
          <div className="num-display text-[22px] font-semibold mt-1.5 text-accent">{formatUsd(total)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Paid</div>
          <div className={`num-display text-[22px] font-semibold mt-1.5 ${order.paid ? 'text-ok' : 'text-bad'}`}>
            {order.paid ? 'Yes' : 'No'}
          </div>
          {order.paymentDate && <div className="text-[10px] text-text-tertiary mt-1">{formatDate(order.paymentDate)}</div>}
        </GlassCard>
      </div>

      <SectionTitle hint={`${items.length} lines`}>Line items</SectionTitle>
      <div className="mb-8">
        <OrderItemsTable
          orderId={id}
          items={items}
          products={allProducts.map((p) => ({ value: p.sku, label: `${p.sku} — ${p.name}` }))}
        />
      </div>

      {shipDetails.length > 0 && (
        <>
          <SectionTitle hint={`${shipDetails.length} shipments`}>Branching</SectionTitle>
          <div className="grid grid-cols-1 gap-3">
            {shipDetails.map((s) => {
              const itemsInShip = shipItemRows.filter((si) => si.shipmentId === s.id);
              return (
                <GlassCard key={s.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span>{s.id}</span>
                        <span className="text-text-tertiary text-[12px]">·</span>
                        <span className="text-text-secondary text-[12px]">{s.carrier ?? '—'}</span>
                        <span className="text-text-tertiary text-[12px]">·</span>
                        <span className="font-mono text-[11px] text-text-tertiary">{s.trackingNumber ?? '—'}</span>
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-1">
                        Shipped {formatDate(s.shipDate)} · ETA {formatDate(s.eta)}
                      </div>
                    </div>
                    <StatusPill status={s.status} label={SHIPMENT_STATUS_LABELS[s.status]} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {itemsInShip.map((si, idx) => (
                      <div
                        key={idx}
                        className="bg-white/[0.025] border border-white/[0.06] rounded-md px-3 py-1.5 text-[12px] flex items-center gap-2"
                      >
                        <span className="font-mono text-text-secondary">{si.sku}</span>
                        <span className="text-text-tertiary">×</span>
                        <span className="font-medium num-display">{formatNum(si.qty)}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
