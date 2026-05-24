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
  if (['complete', 'delivered', 'received', 'paid'].includes(status)) return 'ok';
  if (['partial_shipped', 'in_transit', 'shipped', 'out_for_delivery', 'partial'].includes(status)) return 'warn';
  if (['pending_payment', 'delayed', 'lost', 'cancelled', 'not_started'].includes(status)) return 'bad';
  if (['in_production', 'draft', 'preparing'].includes(status)) return 'info';
  return 'neutral';
}
