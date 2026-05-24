import Link from 'next/link';
import {
  getDashboardKpis,
  getOrderItemsFull,
  getActiveShipments,
} from '@/lib/db/queries';
import { GlassCard, KpiCard, PageHeader, SectionTitle, StatusPill } from '@/components/ui';
import { formatUsd, formatNum, formatDate, SHIPMENT_STATUS_LABELS } from '@/lib/utils';
import { IconArrowUpRight, IconTruckDelivery, IconBox } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [kpis, items, ships] = await Promise.all([
    getDashboardKpis(),
    getOrderItemsFull(),
    getActiveShipments(8),
  ]);

  const inProduction = items
    .filter((i) => i.qtyRemaining > 0)
    .sort((a, b) => b.qtyRemaining - a.qtyRemaining)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Money in, boxes out. Everything still being made."
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <KpiCard label="Open POs" value={formatNum(kpis.openPos)} />
        <KpiCard
          label="Spent this month"
          value={formatUsd(kpis.spentThisMonth)}
          emphasis="accent"
          hint="Paid orders since the 1st"
        />
        <KpiCard
          label="Boxes in transit"
          value={formatNum(kpis.boxesInTransit)}
          emphasis="warn"
          hint="Currently moving"
        />
        <KpiCard
          label="Items in production"
          value={formatNum(kpis.itemsInProduction)}
          hint="Line items still being made"
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <GlassCard className="p-5">
          <SectionTitle hint={`${inProduction.length} items`}>
            <span className="inline-flex items-center gap-1.5">
              <IconBox size={12} stroke={1.75} /> Still in production
            </span>
          </SectionTitle>
          {inProduction.length === 0 ? (
            <p className="text-[13px] text-text-tertiary py-4">Nothing pending — clean state.</p>
          ) : (
            <div className="flex flex-col">
              {inProduction.map((i, idx) => (
                <Link
                  key={i.id}
                  href={`/shipments`}
                  className={`flex items-center justify-between py-2.5 ${
                    idx < inProduction.length - 1 ? 'border-b border-white/[0.04]' : ''
                  } -mx-2 px-2 rounded-md hover:bg-white/[0.02] transition-colors`}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    {i.imageUrl ? (
                      <img src={i.imageUrl} alt="" className="w-10 h-10 rounded-md object-cover border border-white/[0.06]" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                        <IconBox size={14} className="text-text-tertiary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium flex items-center gap-2">
                        <span className="font-mono text-accent text-[12px]">{i.sku}</span>
                        <span className="text-text-tertiary">·</span>
                        <span className="text-text-secondary text-[12px]">{i.orderId}</span>
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-0.5 truncate max-w-[220px]">
                        {i.productName ?? '—'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[13px] font-medium text-warn num-display">
                        {formatNum(i.qtyRemaining)}
                      </div>
                      <div className="text-[10px] text-text-tertiary leading-none">remaining</div>
                    </div>
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
