import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db, orders, products } from '@/lib/db';
import { getOrderItemsFull } from '@/lib/db/queries';
import { PageHeader, GlassCard, SectionTitle } from '@/components/ui';
import { formatUsd, formatDate } from '@/lib/utils';
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

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const shipping = Number(order.shippingCost);
  const total = subtotal + shipping;

  return (
    <>
      <Link href="/orders" className="text-[12px] text-text-tertiary hover:text-text-secondary inline-flex items-center gap-1 mb-3">
        <IconArrowLeft size={12} /> All orders
      </Link>

      <PageHeader
        title={order.id}
        subtitle={`Ordered ${formatDate(order.orderDate)} · ${items.length} line items`}
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <GlassCard className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Goods</div>
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
      <OrderItemsTable
        orderId={id}
        items={items}
        products={allProducts.map((p) => ({ value: p.sku, label: `${p.sku} — ${p.name}` }))}
      />

      <p className="text-[11px] text-text-tertiary mt-6">
        Shipping progress lives on the <Link href="/shipments" className="text-text-secondary hover:text-accent">Shipments</Link> tab.
      </p>
    </>
  );
}
