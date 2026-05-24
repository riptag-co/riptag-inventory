'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  products,
  orders,
  orderItems,
  shipments,
  shipmentItems,
  wishlist,
} from '@/lib/db/schema';
import { nextId } from '@/lib/db/queries';
import { requireUser, requireOwner } from '@/lib/auth';

function coerceNumber(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function coerceInt(v: any): number {
  const n = parseInt(String(v), 10);
  return isNaN(n) ? 0 : n;
}

export async function updateProduct(sku: string, field: string, value: any) {
  await requireOwner();

  if (field === 'sku') {
    const newSku = String(value ?? '').trim().toUpperCase();
    if (!newSku || newSku === sku) return;
    const [orderRef, shipRef, taken] = await Promise.all([
      db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.sku, sku)).limit(1),
      db.select({ id: shipmentItems.id }).from(shipmentItems).where(eq(shipmentItems.sku, sku)).limit(1),
      db.select({ sku: products.sku }).from(products).where(eq(products.sku, newSku)).limit(1),
    ]);
    if (taken.length) throw new Error(`SKU "${newSku}" already exists`);
    if (orderRef.length || shipRef.length) {
      throw new Error('Cannot rename — this SKU is referenced by existing orders or shipments. Delete those first, or create a new product instead.');
    }
    await db.update(products).set({ sku: newSku, updatedAt: new Date() }).where(eq(products.sku, sku));
    revalidatePath('/catalog');
    revalidatePath('/orders');
    revalidatePath('/shipments');
    return;
  }

  const patch: any = { updatedAt: new Date() };
  if (field === 'unitCost' || field === 'unitWeightKg') patch[field] = String(coerceNumber(value));
  else patch[field] = value === '' ? null : value;
  await db.update(products).set(patch).where(eq(products.sku, sku));
  revalidatePath('/catalog');
  revalidatePath('/dashboard');
}

export async function createProduct(_row: any) {
  await requireOwner();
  const newSku = `NEW-${Date.now().toString().slice(-6)}`;
  await db.insert(products).values({
    sku: newSku,
    name: 'New product',
    unitCost: '0',
    unitWeightKg: '0',
    status: 'active',
  });
  revalidatePath('/catalog');
}

export async function deleteProduct(sku: string) {
  await requireOwner();
  await db.delete(products).where(eq(products.sku, sku));
  revalidatePath('/catalog');
}

export async function updateOrder(id: string, field: string, value: any) {
  await requireOwner();
  const patch: any = { updatedAt: new Date() };
  if (field === 'shippingCost') patch[field] = String(coerceNumber(value));
  else if (field === 'paid') patch[field] = value === 'true' || value === true;
  else if (field === 'orderDate' || field === 'paymentDate') patch[field] = value === '' ? null : value;
  else patch[field] = value === '' ? null : value;
  await db.update(orders).set(patch).where(eq(orders.id, id));
  revalidatePath('/orders');
  revalidatePath('/dashboard');
}

export async function createOrder(opts: { status?: 'draft' | 'pending_payment' } = {}) {
  await requireOwner();
  const id = await nextId('orders', 'PO');
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(orders).values({
    id,
    orderDate: today,
    status: opts.status ?? 'pending_payment',
    shippingCost: '0',
    paid: false,
  });
  revalidatePath('/orders');
  revalidatePath('/new-orders');
  return id;
}

export async function promoteDraftOrder(orderId: string) {
  await requireOwner();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'draft') throw new Error('Order is not a draft');

  // Make sure every item has a price
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  if (items.length === 0) throw new Error('Order has no items — add at least one before promoting');
  const unpriced = items.filter((i) => !i.unitPrice || Number(i.unitPrice) <= 0);
  if (unpriced.length > 0) {
    throw new Error(`${unpriced.length} item(s) missing a price. Wait for supplier to quote.`);
  }

  await db.update(orders).set({ status: 'pending_payment', updatedAt: new Date() }).where(eq(orders.id, orderId));
  revalidatePath('/orders');
  revalidatePath('/new-orders');
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/dashboard');
}

export async function revertToDraft(orderId: string) {
  await requireOwner();
  await db
    .update(orders)
    .set({ status: 'draft', paid: false, paymentDate: null, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  revalidatePath('/orders');
  revalidatePath('/new-orders');
  revalidatePath(`/orders/${orderId}`);
}

export async function deleteOrder(id: string) {
  await requireOwner();
  await db.delete(orders).where(eq(orders.id, id));
  revalidatePath('/orders');
}

export async function updateOrderItem(id: string, field: string, value: any) {
  const user = await requireUser();

  if (user.role !== 'owner') {
    // Suppliers may only edit unitPrice, and only on draft orders
    if (field !== 'unitPrice') throw new Error('Suppliers can only edit price');
    const [row] = await db
      .select({ status: orders.status })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(eq(orderItems.id, id))
      .limit(1);
    if (!row || row.status !== 'draft') {
      throw new Error('Price can only be set on draft orders');
    }
  }

  const patch: any = {};
  if (field === 'qtyOrdered') patch[field] = coerceInt(value);
  else if (field === 'unitPrice') patch[field] = String(coerceNumber(value));
  else patch[field] = value === '' ? null : value;
  await db.update(orderItems).set(patch).where(eq(orderItems.id, id));
  revalidatePath('/orders');
  revalidatePath('/new-orders');
  revalidatePath(`/orders/${id}`);
  revalidatePath('/dashboard');
}

export async function createOrderItem(orderId: string, defaults: { sku?: string; qty?: number; price?: number } = {}) {
  await requireOwner();
  await db.insert(orderItems).values({
    orderId,
    sku: defaults.sku ?? '',
    qtyOrdered: defaults.qty ?? 1,
    unitPrice: String(defaults.price ?? 0),
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
  revalidatePath('/dashboard');
}

export async function deleteOrderItem(id: string) {
  await requireOwner();
  await db.delete(orderItems).where(eq(orderItems.id, id));
  revalidatePath('/orders');
  revalidatePath('/dashboard');
}

export type ShipSomeTarget =
  | { type: 'existing'; shipmentId: string }
  | { type: 'new'; carrier?: string; trackingNumber?: string; shipDate?: string; eta?: string };

export async function shipSome(orderItemId: string, qty: number, target: ShipSomeTarget) {
  await requireUser();
  const safeQty = coerceInt(qty);
  if (safeQty <= 0) throw new Error('Quantity must be greater than zero');

  const [item] = await db
    .select({ id: orderItems.id, orderId: orderItems.orderId, sku: orderItems.sku })
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .limit(1);
  if (!item) throw new Error('Order item not found');

  let shipmentId: string;
  if (target.type === 'existing') {
    shipmentId = target.shipmentId;
  } else {
    shipmentId = await nextId('shipments', 'SH');
    await db.insert(shipments).values({
      id: shipmentId,
      carrier: target.carrier || null,
      trackingNumber: target.trackingNumber || null,
      shipDate: target.shipDate || null,
      eta: target.eta || null,
      status: 'preparing',
    });
  }

  await db.insert(shipmentItems).values({
    shipmentId,
    orderId: item.orderId,
    sku: item.sku,
    qty: safeQty,
  });

  revalidatePath('/shipments');
  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { shipmentId };
}

export async function updateShipment(id: string, field: string, value: any) {
  await requireUser();
  const patch: any = { updatedAt: new Date() };
  if (field === 'boxWeightKg') patch[field] = String(coerceNumber(value));
  else if (field === 'shipDate' || field === 'eta' || field === 'actualDelivery') patch[field] = value === '' ? null : value;
  else patch[field] = value === '' ? null : value;

  // Auto-bump: when a tracking number is added while still "preparing", move to "shipped".
  if (field === 'trackingNumber' && value && String(value).trim().length > 0) {
    const [cur] = await db.select({ status: shipments.status }).from(shipments).where(eq(shipments.id, id)).limit(1);
    if (cur?.status === 'preparing') {
      patch.status = 'shipped';
      if (!patch.shipDate) patch.shipDate = new Date().toISOString().slice(0, 10);
    }
  }

  // When user manually sets status to delivered, auto-stamp actual delivery if empty.
  if (field === 'status' && value === 'delivered') {
    const [cur] = await db.select({ actualDelivery: shipments.actualDelivery }).from(shipments).where(eq(shipments.id, id)).limit(1);
    if (!cur?.actualDelivery) {
      patch.actualDelivery = new Date().toISOString().slice(0, 10);
    }
  }

  await db.update(shipments).set(patch).where(eq(shipments.id, id));
  revalidatePath('/shipments');
  revalidatePath('/dashboard');
}

export async function moveShipmentItem(shipmentItemId: string, newShipmentId: string) {
  await requireUser();
  // Verify target shipment exists
  const [target] = await db.select({ id: shipments.id }).from(shipments).where(eq(shipments.id, newShipmentId)).limit(1);
  if (!target) throw new Error('Target shipment not found');
  await db.update(shipmentItems).set({ shipmentId: newShipmentId }).where(eq(shipmentItems.id, shipmentItemId));
  revalidatePath('/shipments');
  revalidatePath('/dashboard');
}

export async function createShipment(_row: any) {
  await requireUser();
  const id = await nextId('shipments', 'SH');
  await db.insert(shipments).values({ id, status: 'preparing', carrier: 'DHL' });
  revalidatePath('/shipments');
  return id;
}

export async function createEmptyShipment(opts: {
  carrier?: string;
  trackingNumber?: string;
  shipDate?: string;
  eta?: string;
  notes?: string;
} = {}) {
  await requireUser();
  const id = await nextId('shipments', 'SH');
  const carrier = opts.carrier || 'DHL';
  const hasTracking = opts.trackingNumber && opts.trackingNumber.trim().length > 0;
  await db.insert(shipments).values({
    id,
    carrier,
    trackingNumber: hasTracking ? opts.trackingNumber!.trim() : null,
    shipDate: opts.shipDate || null,
    eta: opts.eta || null,
    notes: opts.notes || null,
    status: hasTracking ? 'shipped' : 'preparing',
  });
  revalidatePath('/shipments');
  revalidatePath('/dashboard');
  return id;
}

export async function deleteShipment(id: string) {
  await requireOwner();
  await db.delete(shipments).where(eq(shipments.id, id));
  revalidatePath('/shipments');
  revalidatePath('/dashboard');
}

export async function createShipmentItem(shipmentId: string, defaults: { orderId?: string; sku?: string; qty?: number } = {}) {
  await requireUser();
  await db.insert(shipmentItems).values({
    shipmentId,
    orderId: defaults.orderId ?? '',
    sku: defaults.sku ?? '',
    qty: defaults.qty ?? 1,
  });
  revalidatePath('/shipments');
  revalidatePath(`/orders`);
  revalidatePath('/dashboard');
}

export async function updateShipmentItem(id: string, field: string, value: any) {
  await requireUser();
  const patch: any = {};
  if (field === 'qty') patch[field] = coerceInt(value);
  else patch[field] = value === '' ? null : value;
  await db.update(shipmentItems).set(patch).where(eq(shipmentItems.id, id));
  revalidatePath('/shipments');
  revalidatePath('/orders');
  revalidatePath('/dashboard');
}

export async function deleteShipmentItem(id: string) {
  await requireUser();
  await db.delete(shipmentItems).where(eq(shipmentItems.id, id));
  revalidatePath('/shipments');
  revalidatePath('/dashboard');
}

export async function updateWishlist(id: string, field: string, value: any) {
  await requireUser();
  const patch: any = {};
  if (field === 'targetQty' || field === 'leadTimeDays') patch[field] = value === '' ? null : coerceInt(value);
  else if (field === 'supplierPrice') patch[field] = value === '' ? null : String(coerceNumber(value));
  else patch[field] = value === '' ? null : value;
  await db.update(wishlist).set(patch).where(eq(wishlist.id, id));
  revalidatePath('/wishlist');
}

export async function createWishlistItem(_row: any) {
  await requireUser();
  await db.insert(wishlist).values({ description: 'New item', status: 'open' });
  revalidatePath('/wishlist');
}

export async function deleteWishlistItem(id: string) {
  await requireOwner();
  await db.delete(wishlist).where(eq(wishlist.id, id));
  revalidatePath('/wishlist');
}
