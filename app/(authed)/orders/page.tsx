import Link from 'next/link';
import { getOrdersFull } from '@/lib/db/queries';
import { PageHeader, GlassCard, StatusPill } from '@/components/ui';
import { formatUsd, formatNum, formatDate, ORDER_STATUS_LABELS } from '@/lib/utils';
import { OrdersTable } from './table';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const orders = await getOrdersFull();
  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Every purchase order. Click any row to see the line items and branching shipments."
      />
      <OrdersTable orders={orders} />
    </>
  );
}
