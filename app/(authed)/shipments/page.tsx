import { desc } from 'drizzle-orm';
import { db, shipments } from '@/lib/db';
import { getOrderBranching, getAllShipmentBoxes } from '@/lib/db/queries';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { ShipmentsView } from './shipments-view';

export const dynamic = 'force-dynamic';

export default async function ShipmentsPage() {
  const user = await requireUser();
  const [branching, boxes, allShipments] = await Promise.all([
    getOrderBranching({ paidOnly: true }),
    getAllShipmentBoxes(),
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
        subtitle="By Order shows what's been shipped per item. By Box shows every physical shipment and what's inside it."
      />
      <ShipmentsView
        orders={branching}
        boxes={boxes}
        existingShipments={allShipments}
        readOnly={user.role !== 'owner' && user.role !== 'supplier'}
        isOwner={user.role === 'owner'}
      />
    </>
  );
}
