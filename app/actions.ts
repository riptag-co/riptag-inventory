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

export async function createOrder(_row: any) {
  await requireOwner();
  const id = await nextId('orders', 'PO');
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(orders).values({
    id,
    orderDate: today,
    status: 'draft',
    shippingCost: '0',
    paid: false,
  });
  revalidatePath('/orders');
  return id;
}

export async function deleteOrder(id: string) {
  await requireOwner();
  await db.delete(orders).where(eq(orders.id, id));
  revalidatePath('/orders');
}

export async function updateOrderItem(id: string, field: string, value: any) {
  await requireOwner();
  const patch: any = {};
  if (field === 'qtyOrdered') patch[field] = coerceInt(value);
  else if (field === 'unitPrice') patch[field] = String(coerceNumber(value));
  else patch[field] = value === '' ? null : value;
  await db.update(orderItems).set(patch).where(eq(orderItems.id, id));
  revalidatePath('/orders');
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

export async function updateShipment(id: string, field: string, value: any) {
  await requireUser();
  const patch: any = { updatedAt: new Date() };
  if (field === 'boxWeightKg') patch[field] = String(coerceNumber(value));
  else if (field === 'shipDate' || field === 'eta' || field === 'actualDelivery') patch[field] = value === '' ? null : value;
  else patch[field] = value === '' ? null : value;
  await db.update(shipments).set(patch).where(eq(shipments.id, id));
  revalidatePath('/shipments');
  revalidatePath('/dashboard');
}

export async function createShipment(_row: any) {
  await requireUser();
  const id = await nextId('shipments', 'SH');
  await db.insert(shipments).values({ id, status: 'preparing' });
  revalidatePath('/shipments');
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
