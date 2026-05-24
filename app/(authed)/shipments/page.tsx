import { getAllShipments } from '@/lib/db/queries';
import { db, products, orders } from '@/lib/db';
import { PageHeader } from '@/components/ui';
import { ShipmentsTable } from './table';

export const dynamic = 'force-dynamic';

export default async function ShipmentsPage() {
  const [ships, productsList, ordersList] = await Promise.all([
    getAllShipments(),
    db.select().from(products),
    db.select().from(orders),
  ]);

  return (
    <>
      <PageHeader
        title="Shipments"
        subtitle="Every physical box. Tracking number, carrier, and what's inside."
      />
      <ShipmentsTable
        shipments={ships}
        productOptions={productsList.map((p) => ({ value: p.sku, label: `${p.sku} — ${p.name}` }))}
        orderOptions={ordersList.map((o) => ({ value: o.id, label: o.id }))}
      />
    </>
  );
}
