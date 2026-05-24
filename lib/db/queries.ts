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
  boxesInTransit: number;
  spentThisMonth: number;
  itemsInProduction: number;
};

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const rows = await db.execute<{
    open_pos: number;
    boxes_in_transit: number;
    spent_this_month: string;
    items_in_production: number;
  }>(sql`
    select
      (select count(*)::int from orders where status != 'cancelled') as open_pos,
      (select count(*)::int from shipments where status in ('shipped','in_transit','out_for_delivery')) as boxes_in_transit,
      coalesce((
        select sum(o.shipping_cost + coalesce((
          select sum(oi.qty_ordered * oi.unit_price) from order_items oi where oi.order_id = o.id
        ), 0))::numeric
        from orders o
        where o.paid = true
          and o.payment_date is not null
          and o.payment_date >= date_trunc('month', current_date)
      ), 0) as spent_this_month,
      (select count(*)::int from order_items oi
       where oi.qty_ordered > coalesce(
         (select sum(si.qty)::int from shipment_items si
          where si.order_id = oi.order_id and si.sku = oi.sku), 0)
      ) as items_in_production
  `);
  const r = rows.rows[0];
  return {
    openPos: Number(r.open_pos),
    boxesInTransit: Number(r.boxes_in_transit),
    spentThisMonth: Number(r.spent_this_month),
    itemsInProduction: Number(r.items_in_production),
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

export type OrderBranchShipment = {
  shipmentItemId: string;
  shipmentId: string;
  qty: number;
  carrier: string | null;
  trackingNumber: string | null;
  status: string;
  shipDate: string | null;
  eta: string | null;
  actualDelivery: string | null;
  notes: string | null;
};

export type OrderBranchItem = {
  orderItemId: string;
  sku: string;
  productName: string | null;
  imageUrl: string | null;
  qtyOrdered: number;
  qtyShipped: number;
  qtyRemaining: number;
  shipments: OrderBranchShipment[];
};

export type OrderBranch = {
  orderId: string;
  orderDate: string;
  status: string;
  paid: boolean;
  items: OrderBranchItem[];
};

export async function getOrderBranching(): Promise<OrderBranch[]> {
  const rows = await db.execute<{
    order_id: string;
    order_date: string;
    order_status: string;
    order_paid: boolean;
    order_item_id: string;
    sku: string;
    product_name: string | null;
    image_url: string | null;
    qty_ordered: number;
    item_created_at: string;
    ship_item_id: string | null;
    shipment_id: string | null;
    ship_qty: number | null;
    carrier: string | null;
    tracking_number: string | null;
    ship_status: string | null;
    ship_date: string | null;
    eta: string | null;
    actual_delivery: string | null;
    ship_notes: string | null;
    ship_created_at: string | null;
  }>(sql`
    select
      o.id as order_id,
      to_char(o.order_date, 'YYYY-MM-DD') as order_date,
      o.status::text as order_status,
      o.paid as order_paid,
      oi.id as order_item_id,
      oi.sku,
      p.name as product_name,
      p.image_url,
      oi.qty_ordered,
      oi.created_at as item_created_at,
      si.id as ship_item_id,
      si.shipment_id,
      si.qty as ship_qty,
      s.carrier,
      s.tracking_number,
      s.status::text as ship_status,
      to_char(s.ship_date, 'YYYY-MM-DD') as ship_date,
      to_char(s.eta, 'YYYY-MM-DD') as eta,
      to_char(s.actual_delivery, 'YYYY-MM-DD') as actual_delivery,
      s.notes as ship_notes,
      s.created_at as ship_created_at
    from orders o
    join order_items oi on oi.order_id = o.id
    left join products p on p.sku = oi.sku
    left join shipment_items si on si.order_id = oi.order_id and si.sku = oi.sku
    left join shipments s on s.id = si.shipment_id
    order by o.order_date desc, o.id desc, oi.created_at asc, s.ship_date asc nulls last, s.created_at asc nulls last
  `);

  const orderMap = new Map<string, OrderBranch>();
  const itemMap = new Map<string, OrderBranchItem>();

  for (const r of rows.rows) {
    let order = orderMap.get(r.order_id);
    if (!order) {
      order = {
        orderId: r.order_id,
        orderDate: r.order_date,
        status: r.order_status,
        paid: r.order_paid,
        items: [],
      };
      orderMap.set(r.order_id, order);
    }

    let item = itemMap.get(r.order_item_id);
    if (!item) {
      item = {
        orderItemId: r.order_item_id,
        sku: r.sku,
        productName: r.product_name,
        imageUrl: r.image_url,
        qtyOrdered: Number(r.qty_ordered),
        qtyShipped: 0,
        qtyRemaining: Number(r.qty_ordered),
        shipments: [],
      };
      itemMap.set(r.order_item_id, item);
      order.items.push(item);
    }

    if (r.ship_item_id && r.shipment_id && r.ship_qty != null) {
      item.shipments.push({
        shipmentItemId: r.ship_item_id,
        shipmentId: r.shipment_id,
        qty: Number(r.ship_qty),
        carrier: r.carrier,
        trackingNumber: r.tracking_number,
        status: r.ship_status ?? 'preparing',
        shipDate: r.ship_date,
        eta: r.eta,
        actualDelivery: r.actual_delivery,
        notes: r.ship_notes,
      });
      item.qtyShipped += Number(r.ship_qty);
      item.qtyRemaining = item.qtyOrdered - item.qtyShipped;
    }
  }

  return Array.from(orderMap.values());
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
