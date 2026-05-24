import Link from 'next/link';
import {
  getDashboardKpis,
  getOrderItemsFull,
  getActiveShipments,
} from '@/lib/db/queries';
import { GlassCard, KpiCard, PageHeader, SectionTitle, StatusPill } from '@/components/ui';
import { formatUsd, formatNum, formatDate, SHIPMENT_STATUS_LABELS } from '@/lib/utils';
import { IconArrowUpRight, IconTruckDelivery, IconAlertTriangle } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [kpis, items, ships] = await Promise.all([
    getDashboardKpis(),
    getOrderItemsFull(),
    getActiveShipments(8),
  ]);

  const attention = items
    .filter((i) => i.fulfillmentStatus !== 'complete' && i.qtyRemaining > 0)
    .sort((a, b) => b.qtyRemaining - a.qtyRemaining)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live view of every order, shipment, and unit still owed"
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <KpiCard label="Open POs" value={formatNum(kpis.openPos)} />
        <KpiCard
          label="Units in transit"
          value={formatNum(kpis.unitsInTransit)}
          emphasis="warn"
          hint="Across all active shipments"
        />
        <KpiCard
          label="Units owed"
          value={formatNum(kpis.unitsOwed)}
          emphasis={kpis.unitsOwed > 500 ? 'bad' : 'default'}
          hint="Still in production"
        />
        <KpiCard label="$ outstanding" value={formatUsd(kpis.outstandingUsd)} emphasis="accent" />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <GlassCard className="p-5">
          <SectionTitle hint={`${attention.length} items`}>
            <span className="inline-flex items-center gap-1.5">
              <IconAlertTriangle size={12} stroke={1.75} /> Needs attention
            </span>
          </SectionTitle>
          {attention.length === 0 ? (
            <p className="text-[13px] text-text-tertiary py-4">Nothing pending — clean state.</p>
          ) : (
            <div className="flex flex-col">
              {attention.map((i, idx) => (
                <Link
                  key={i.id}
                  href={`/orders/${i.orderId}`}
                  className={`flex items-center justify-between py-2.5 ${
                    idx < attention.length - 1 ? 'border-b border-white/[0.04]' : ''
                  } -mx-2 px-2 rounded-md hover:bg-white/[0.02] transition-colors`}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium flex items-center gap-2">
                      <span className="font-mono text-text-secondary text-[12px]">{i.sku}</span>
                      <span className="text-text-tertiary">·</span>
                      <span className="text-text-secondary text-[12px]">{i.orderId}</span>
                    </div>
                    <div className="text-[11px] text-text-tertiary mt-0.5 truncate max-w-[260px]">
                      {i.productName ?? '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[13px] font-medium text-bad num-display">
                        {formatNum(i.qtyRemaining)}
                      </div>
                      <div className="text-[10px] text-text-tertiary leading-none">owed</div>
                    </div>
                    <StatusPill status={i.fulfillmentStatus} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle hint={`${ships.length} active`}>
            <span className="inline-flex items-center gap-1.5">
              <IconTruckDelivery size={12} stroke={1.75} /> Shipments
            </span>
          </SectionTitle>
          {ships.length === 0 ? (
            <p className="text-[13px] text-text-tertiary py-4">No active shipments.</p>
          ) : (
            <div className="flex flex-col">
              {ships.map((s, idx) => (
                <Link
                  key={s.id}
                  href={`/shipments`}
                  className={`flex items-center justify-between py-2.5 ${
                    idx < ships.length - 1 ? 'border-b border-white/[0.04]' : ''
                  } -mx-2 px-2 rounded-md hover:bg-white/[0.02] transition-colors`}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium flex items-center gap-2">
                      <span className="text-text-primary">{s.id}</span>
                      <span className="text-text-tertiary text-[11px]">·</span>
                      <span className="text-text-secondary text-[11px]">{s.carrier ?? '—'}</span>
                    </div>
                    <div className="text-[10px] text-text-tertiary font-mono truncate max-w-[260px] mt-0.5">
                      {s.trackingNumber ?? '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-text-tertiary">{formatDate(s.shipDate)}</span>
                    <StatusPill status={s.status} label={SHIPMENT_STATUS_LABELS[s.status]} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href="/orders"
          className="text-[12px] text-text-secondary hover:text-accent transition-colors flex items-center gap-1"
        >
          View all orders <IconArrowUpRight size={12} stroke={2} />
        </Link>
      </div>
    </>
  );
}
