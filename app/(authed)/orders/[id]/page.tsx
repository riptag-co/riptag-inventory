import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, asc } from 'drizzle-orm';
import { db, orders, products } from '@/lib/db';
import { getOrderItemsFull } from '@/lib/db/queries';
import { requireUser } from '@/lib/auth';
import { PageHeader, GlassCard, SectionTitle } from '@/components/ui';
import { formatUsd, formatDate } from '@/lib/utils';
import { OrderItemsGrid } from './items-grid';
import { OrderHeader } from './order-header';
import { IconArrowLeft } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const orderRows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!orderRows.length) notFound();
  const order = orderRows[0];

  const items = await getOrderItemsFull(id);
  const allProducts = await db.select().from(products).orderBy(asc(products.sku));

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const shipping = Number(order.shippingCost);
  const total = subtotal + shipping;
  const paid = order.paid;
  const readOnly = user.role !== 'owner';

  return (
    <>
      <Link href="/orders" className="text-[12px] text-text-tertiary hover:text-text-secondary inline-flex items-center gap-1 mb-3">
        <IconArrowLeft size={12} /> All orders
      </Link>

      <PageHeader
        title={order.id}
        subtitle={`Ordered ${formatDate(order.orderDate)} · ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
      />

      <OrderHeader
        orderId={order.id}
        paid={paid}
        paymentDate={order.paymentDate}
        shippingCost={shipping}
        subtotal={subtotal}
        total={total}
        notes={order.notes}
        readOnly={readOnly}
      />

      <div className="mt-8">
        <SectionTitle hint={`${items.length} ${items.length === 1 ? 'product' : 'products'}`}>
          What you want
        </SectionTitle>
        <OrderItemsGrid
          orderId={id}
          items={items}
          catalog={allProducts.map((p) => ({
            sku: p.sku,
            name: p.name,
            imageUrl: p.imageUrl,
            unitCost: String(p.unitCost ?? '0'),
          }))}
          readOnly={readOnly}
        />
      </div>

      {paid && (
        <p className="text-[11px] text-text-tertiary mt-6">
          Shipping progress lives on the <Link href="/shipments" className="text-text-secondary hover:text-accent">Shipments</Link> tab.
        </p>
      )}
    </>
  );
}
