import { desc } from 'drizzle-orm';
import { db, shipments } from '@/lib/db';
import { getOrderBranching } from '@/lib/db/queries';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { ShipmentsTree } from './tree';

export const dynamic = 'force-dynamic';

export default async function ShipmentsPage() {
  const user = await requireUser();
  const [branching, allShipments] = await Promise.all([
    getOrderBranching(),
    db
      .select({
        id: shipments.id,
        carrier: shipments.carrier,
        trackingNumber: shipments.trackingNumber,
        status: shipments.status,
      })
      .from(shipments)
      .orderBy(desc(shipments.shipDate)),
  ]);

  return (
    <>
      <PageHeader
        title="Shipments"
        subtitle="What's in the box and where it's going. Tap an item to allocate units to a new or existing shipment."
      />
      <ShipmentsTree
        orders={branching}
        existingShipments={allShipments}
        readOnly={user.role !== 'owner' && user.role !== 'supplier'}
      />
    </>
  );
}
