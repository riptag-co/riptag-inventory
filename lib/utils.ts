import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatDate(d: string | Date | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function relativeTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_payment: 'Pending payment',
  paid: 'Paid',
  in_production: 'In production',
  partial_shipped: 'Partial shipped',
  fully_shipped: 'Fully shipped',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  preparing: 'Preparing',
  shipped: 'Shipped',
  in_transit: 'Shipped',
  out_for_delivery: 'Shipped',
  delivered: 'Delivered',
  received: 'Delivered',
  delayed: 'Shipped',
  lost: 'Shipped',
};

/** The only 3 statuses we surface in dropdowns. Legacy DB values normalize to these. */
export const SHIPMENT_STATUS_CHOICES = ['preparing', 'shipped', 'delivered'] as const;
export type ShipmentStatusChoice = (typeof SHIPMENT_STATUS_CHOICES)[number];

/** Normalize any legacy DB status into one of the 3 canonical values for display. */
export function normalizeShipmentStatus(status: string): ShipmentStatusChoice {
  if (status === 'preparing') return 'preparing';
  if (status === 'delivered' || status === 'received') return 'delivered';
  // shipped, in_transit, out_for_delivery, delayed, lost → shipped
  return 'shipped';
}

/** Carriers the supplier actually uses. DHL is the default. */
export const CARRIERS = ['DHL', 'FedEx'] as const;
export type Carrier = (typeof CARRIERS)[number];
export const DEFAULT_CARRIER: Carrier = 'DHL';

/** Returns a tracking URL for known carriers, or null if we don't know how to link it. */
export function carrierTrackingUrl(carrier: string | null | undefined, tracking: string | null | undefined): string | null {
  if (!tracking) return null;
  const t = encodeURIComponent(tracking.trim());
  switch ((carrier ?? '').toLowerCase()) {
    case 'dhl':
      return `https://www.dhl.com/en/express/tracking.html?AWB=${t}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    case 'ups':
      return `https://www.ups.com/track?tracknum=${t}`;
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case 'sf express':
      return `https://www.sf-express.com/sf-service-web/service/bills/${t}/routes`;
    default:
      return null;
  }
}

export function statusVariant(status: string): 'ok' | 'warn' | 'bad' | 'info' | 'neutral' {
  // green / done
  if (['complete', 'delivered', 'received', 'paid', 'all_delivered', 'ok'].includes(status)) return 'ok';
  // blue / moving
  if (['in_transit', 'shipped', 'out_for_delivery', 'in_progress'].includes(status)) return 'info';
  // yellow / needs action
  if (['preparing', 'pending_payment', 'partial', 'partial_shipped', 'awaiting_quote', 'warn'].includes(status)) return 'warn';
  // red / problem
  if (['delayed', 'lost', 'cancelled', 'not_started', 'bad'].includes(status)) return 'bad';
  // grey / draft / unknown
  if (['draft', 'in_production'].includes(status)) return 'neutral';
  return 'neutral';
}

export type ShipmentStageStatus = 'not_started' | 'preparing' | 'shipped' | 'all_delivered';

/**
 * Roll up many shipment statuses into a single stage for an order or item.
 * Normalizes legacy values first, then picks the worst stage (preparing > shipped > all_delivered).
 */
export function rollupShipmentStage(statuses: string[]): ShipmentStageStatus {
  if (statuses.length === 0) return 'not_started';
  const normalized = statuses.map(normalizeShipmentStatus);
  const hasPreparing = normalized.some((s) => s === 'preparing');
  const hasShipped = normalized.some((s) => s === 'shipped');
  const allDone = normalized.every((s) => s === 'delivered');
  if (allDone) return 'all_delivered';
  if (hasPreparing) return 'preparing';
  if (hasShipped) return 'shipped';
  return 'preparing';
}

export const STAGE_LABELS: Record<ShipmentStageStatus, string> = {
  not_started: 'Not started',
  preparing: 'Preparing',
  shipped: 'Shipped',
  all_delivered: 'All delivered',
};
