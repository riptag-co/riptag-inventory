import { getOrdersFull } from '@/lib/db/queries';
import { PageHeader } from '@/components/ui';
import { OrdersTable } from '../orders/table';

export const dynamic = 'force-dynamic';

export default async function NewOrdersPage() {
  const orders = await getOrdersFull({ onlyStatus: 'draft' });
  return (
    <>
      <PageHeader
        title="New Orders"
        subtitle="Drafts awaiting prices from the supplier. Once every item is quoted, push it to Orders to pay."
      />
      <OrdersTable orders={orders} mode="draft" />
    </>
  );
}
