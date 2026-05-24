'use client';

import { useState } from 'react';
import { IconHierarchy2, IconPackages } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { ShipmentsTree } from './tree';
import { BoxesGrid } from './boxes';
import type { OrderBranch, ShipmentBox } from '@/lib/db/queries';

export function ShipmentsView({
  orders,
  boxes,
  existingShipments,
  readOnly,
  isOwner,
}: {
  orders: OrderBranch[];
  boxes: ShipmentBox[];
  existingShipments: { id: string; carrier: string | null; trackingNumber: string | null; status: string }[];
  readOnly: boolean;
  isOwner: boolean;
}) {
  const [view, setView] = useState<'tree' | 'boxes'>('tree');

  // Supplier never sees the box-centric view — keep their workflow focused on order tree.
  if (!isOwner) {
    return (
      <ShipmentsTree
        orders={orders}
        existingShipments={existingShipments}
        readOnly={readOnly}
        isOwner={isOwner}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-5 bg-white/[0.025] border border-white/[0.06] p-1 rounded-lg w-fit">
        <TabButton active={view === 'tree'} onClick={() => setView('tree')} icon={<IconHierarchy2 size={13} />}>
          By Order
        </TabButton>
        <TabButton active={view === 'boxes'} onClick={() => setView('boxes')} icon={<IconPackages size={13} />}>
          By Box <span className="text-text-tertiary ml-1">({boxes.length})</span>
        </TabButton>
      </div>

      {view === 'tree' && (
        <ShipmentsTree
          orders={orders}
          existingShipments={existingShipments}
          readOnly={readOnly}
          isOwner={isOwner}
        />
      )}

      {view === 'boxes' && <BoxesGrid boxes={boxes} readOnly={readOnly} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition',
        active ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'
      )}
    >
      {icon}
      {children}
    </button>
  );
}
