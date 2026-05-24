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
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  received: 'Received',
  delayed: 'Delayed',
  lost: 'Lost',
};

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

export type ShipmentStageStatus = 'not_started' | 'preparing' | 'in_transit' | 'all_delivered';

/**
 * Roll up many shipment statuses into a single stage for an order or item.
 * Worst-cased: preparing beats in_transit, in_transit beats all_delivered.
 */
export function rollupShipmentStage(statuses: string[]): ShipmentStageStatus {
  if (statuses.length === 0) return 'not_started';
  const hasPreparing = statuses.some((s) => s === 'preparing');
  const hasMoving = statuses.some((s) => ['shipped', 'in_transit', 'out_for_delivery', 'delayed'].includes(s));
  const allDone = statuses.every((s) => ['delivered', 'received'].includes(s));
  if (allDone) return 'all_delivered';
  if (hasPreparing) return 'preparing';
  if (hasMoving) return 'in_transit';
  return 'preparing';
}

export const STAGE_LABELS: Record<ShipmentStageStatus, string> = {
  not_started: 'Not started',
  preparing: 'Preparing',
  in_transit: 'In transit',
  all_delivered: 'All delivered',
};
