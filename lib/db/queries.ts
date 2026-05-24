import { sql, eq, and, desc, asc, inArray } from 'drizzle-orm';
import { db } from './index';
import {
  orders,
  orderItems,
  products,
  shipments,
  shipmentItems,
  wishlist,
} from './schema';

export type OrderItemFull = {
  id: string;
  orderId: string;
  sku: string;
  productName: string | null;
  imageUrl: string | null;
  qtyOrdered: number;
  unitPrice: number;
  lineTotal: number;
  qtyShipped: number;
  qtyRemaining: number;
  fulfillmentStatus: 'not_started' | 'partial' | 'complete';
  notes: string | null;
};

export async function getOrderItemsFull(orderId?: string): Promise<OrderItemFull[]> {
  const rows = await db.execute<{
    id: string;
    order_id: string;
    sku: string;
    product_name: string | null;
    image_url: string | null;
    qty_ordered: number;
    unit_price: string;
    line_total: string;
    qty_shipped: string;
    qty_remaining: string;
    fulfillment_status: 'not_started' | 'partial' | 'complete';
    notes: string | null;
  }>(sql`
    select
      oi.id,
      oi.order_id,
      oi.sku,
      p.name as product_name,
      p.image_url,
      oi.qty_ordered,
      oi.unit_price,
      (oi.qty_ordered * oi.unit_price) as line_total,
      coalesce((select sum(si.qty)::int from shipment_items si
                where si.order_id = oi.order_id and si.sku = oi.sku), 0) as qty_shipped,
      (oi.qty_ordered - coalesce((select sum(si.qty)::int from shipment_items si
                                   where si.order_id = oi.order_id and si.sku = oi.sku), 0)) as qty_remaining,
      case
        when coalesce((select sum(si.qty)::int from shipment_items si
                       where si.order_id = oi.order_id and si.sku = oi.sku), 0) = 0 then 'not_started'
        when coalesce((select sum(si.qty)::int from shipment_items si
                       where si.order_id = oi.order_id and si.sku = oi.sku), 0) >= oi.qty_ordered then 'complete'
        else 'partial'
      end as fulfillment_status,
      oi.notes
    from order_items oi
    left join products p on p.sku = oi.sku
    ${orderId ? sql`where oi.order_id = ${orderId}` : sql``}
    order by oi.order_id desc, oi.created_at asc
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    sku: r.sku,
    productName: r.product_name,
    imageUrl: r.image_url,
    qtyOrdered: r.qty_ordered,
    unitPrice: Number(r.unit_price),
    lineTotal: Number(r.line_total),
    qtyShipped: Number(r.qty_shipped),
    qtyRemaining: Number(r.qty_remaining),
    fulfillmentStatus: r.fulfillment_status,
    notes: r.notes,
  }));
}

export type DashboardKpis = {
  openPos: number;
  unitsInTransit: number;
  unitsOwed: number;
  outstandingUsd: number;
};

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const rows = await db.execute<{
    open_pos: number;
    units_in_transit: number;
    units_owed: number;
    outstanding_usd: string;
  }>(sql`
    select
      (select count(*)::int from orders where status not in ('complete','cancelled')) as open_pos,
      coalesce((select sum(si.qty)::int from shipment_items si
                join shipments s on s.id = si.shipment_id
                where s.status in ('shipped','in_transit','out_for_delivery')), 0) as units_in_transit,
      coalesce((select sum(oi.qty_ordered)::int - coalesce(sum(
        (select coalesce(sum(si.qty),0) from shipment_items si
          where si.order_id = oi.order_id and si.sku = oi.sku)
      )::int, 0) from order_items oi), 0) as units_owed,
      coalesce((
        select sum(o.shipping_cost + coalesce((
          select sum(oi.qty_ordered * oi.unit_price) from order_items oi where oi.order_id = o.id
        ), 0))::numeric
        from orders o where o.paid = false and o.status not in ('cancelled')
      ), 0) as outstanding_usd
  `);
  const r = rows.rows[0];
  return {
    openPos: Number(r.open_pos),
    unitsInTransit: Number(r.units_in_transit),
    unitsOwed: Number(r.units_owed),
    outstandingUsd: Number(r.outstanding_usd),
  };
}

export type OrderFull = {
  id: string;
  orderDate: string;
  status: string;
  shippingCost: number;
  subtotal: number;
  total: number;
  paid: boolean;
  paymentDate: string | null;
  notes: string | null;
  lineCount: number;
};

export async function getOrdersFull(): Promise<OrderFull[]> {
  const rows = await db.execute<{
    id: string;
    order_date: string;
    status: string;
    shipping_cost: string;
    subtotal: string;
    total: string;
    paid: boolean;
    payment_date: string | null;
    notes: string | null;
    line_count: number;
  }>(sql`
    select
      o.id,
      to_char(o.order_date, 'YYYY-MM-DD') as order_date,
      o.status::text as status,
      o.shipping_cost,
      coalesce((select sum(oi.qty_ordered * oi.unit_price) from order_items oi where oi.order_id = o.id), 0) as subtotal,
      (coalesce((select sum(oi.qty_ordered * oi.unit_price) from order_items oi where oi.order_id = o.id), 0) + o.shipping_cost) as total,
      o.paid,
      to_char(o.payment_date, 'YYYY-MM-DD') as payment_date,
      o.notes,
      (select count(*)::int from order_items oi where oi.order_id = o.id) as line_count
    from orders o
    order by o.order_date desc, o.id desc
  `);
  return rows.rows.map((r) => ({
    id: r.id,
    orderDate: r.order_date,
    status: r.status,
    shippingCost: Number(r.shipping_cost),
    subtotal: Number(r.subtotal),
    total: Number(r.total),
    paid: r.paid,
    paymentDate: r.payment_date,
    notes: r.notes,
    lineCount: r.line_count,
  }));
}

export async function getActiveShipments(limit = 10) {
  return await db
    .select()
    .from(shipments)
    .where(
      sql`${shipments.status} in ('preparing','shipped','in_transit','out_for_delivery','delivered')`
    )
    .orderBy(desc(shipments.shipDate))
    .limit(limit);
}

export async function getAllShipments() {
  return await db.select().from(shipments).orderBy(desc(shipments.shipDate));
}

export async function getAllProducts() {
  return await db.select().from(products).orderBy(asc(products.sku));
}

export async function getAllWishlist() {
  return await db.select().from(wishlist).orderBy(desc(wishlist.createdAt));
}

export async function getShipmentContents(shipmentId: string) {
  const rows = await db.execute<{
    id: string;
    shipment_id: string;
    order_id: string;
    sku: string;
    product_name: string | null;
    qty: number;
    notes: string | null;
  }>(sql`
    select si.id, si.shipment_id, si.order_id, si.sku, p.name as product_name, si.qty, si.notes
    from shipment_items si
    left join products p on p.sku = si.sku
    where si.shipment_id = ${shipmentId}
    order by si.created_at asc
  `);
  return rows.rows;
}

export async function nextId(table: 'orders' | 'shipments', prefix: 'PO' | 'SH'): Promise<string> {
  const rows = await db.execute<{ max_n: number }>(
    table === 'orders'
      ? sql`select coalesce(max(substring(id from 4)::int), 0) as max_n from orders where id like ${prefix + '-%'}`
      : sql`select coalesce(max(substring(id from 4)::int), 0) as max_n from shipments where id like ${prefix + '-%'}`
  );
  const n = (rows.rows[0]?.max_n ?? 0) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}
