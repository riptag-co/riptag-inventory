import { getOrdersFull } from '@/lib/db/queries';
import { PageHeader } from '@/components/ui';
import { OrdersTable } from './table';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const orders = await getOrdersFull({ excludeStatus: 'draft' });
  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Priced and confirmed. Yellow = needs payment, green = paid and shipping."
      />
      <OrdersTable orders={orders} mode="active" />
    </>
  );
}
