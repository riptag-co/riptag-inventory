import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, asc } from 'drizzle-orm';
import { db, orders, products } from '@/lib/db';
import { getOrderItemsFull } from '@/lib/db/queries';
import { requireUser } from '@/lib/auth';
import { PageHeader, SectionTitle } from '@/components/ui';
import { formatDate } from '@/lib/utils';
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
  const isDraft = order.status === 'draft';
  const hasZeroPriceItems = items.some((i) => i.unitPrice <= 0);

  // For drafts: owner can add/remove items, supplier can edit prices only.
  // For active orders: owner only.
  const itemsReadOnly = !(
    user.role === 'owner' || (user.role === 'supplier' && isDraft)
  );

  const backHref = isDraft ? '/new-orders' : '/orders';
  const backLabel = isDraft ? 'All drafts' : 'All orders';

  return (
    <>
      <Link href={backHref} className="text-[12px] text-text-tertiary hover:text-text-secondary inline-flex items-center gap-1 mb-3">
        <IconArrowLeft size={12} /> {backLabel}
      </Link>

      <PageHeader
        title={order.id}
        subtitle={`${isDraft ? 'Drafted' : 'Ordered'} ${formatDate(order.orderDate)} · ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
      />

      <OrderHeader
        orderId={order.id}
        status={order.status}
        paid={order.paid}
        paymentDate={order.paymentDate}
        shippingCost={shipping}
        subtotal={subtotal}
        total={total}
        notes={order.notes}
        readOnly={user.role !== 'owner'}
        isOwner={user.role === 'owner'}
        itemCount={items.length}
        hasZeroPriceItems={hasZeroPriceItems}
      />

      <div className="mt-8">
        <SectionTitle hint={`${items.length} ${items.length === 1 ? 'product' : 'products'}`}>
          {isDraft ? 'What you want' : 'What was ordered'}
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
          readOnly={itemsReadOnly}
          allowOnlyPriceEdit={user.role === 'supplier' && isDraft}
        />
      </div>

      {!isDraft && order.paid && (
        <p className="text-[11px] text-text-tertiary mt-6">
          Shipping progress lives on the <Link href="/shipments" className="text-text-secondary hover:text-accent">Shipments</Link> tab.
        </p>
      )}
    </>
  );
}
