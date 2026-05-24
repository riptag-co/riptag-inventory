import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  date,
  boolean,
  timestamp,
  uuid,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['owner', 'supplier']);
export const orderStatusEnum = pgEnum('order_status', [
  'draft',
  'pending_payment',
  'paid',
  'in_production',
  'partial_shipped',
  'fully_shipped',
  'complete',
  'cancelled',
]);
export const shipmentStatusEnum = pgEnum('shipment_status', [
  'preparing',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'received',
  'delayed',
  'lost',
]);
export const productStatusEnum = pgEnum('product_status', ['active', 'discontinued']);
export const wishlistStatusEnum = pgEnum('wishlist_status', ['open', 'promoted', 'rejected']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('supplier'),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const products = pgTable('products', {
  sku: varchar('sku', { length: 32 }).primaryKey(),
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  unitCost: numeric('unit_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  unitWeightKg: numeric('unit_weight_kg', { precision: 10, scale: 3 }).notNull().default('0'),
  variationNotes: text('variation_notes'),
  status: productStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable('orders', {
  id: varchar('id', { length: 16 }).primaryKey(),
  orderDate: date('order_date').notNull().defaultNow(),
  status: orderStatusEnum('status').notNull().default('draft'),
  shippingCost: numeric('shipping_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  paid: boolean('paid').notNull().default(false),
  paymentDate: date('payment_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: varchar('order_id', { length: 16 }).notNull().references(() => orders.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 32 }).notNull().references(() => products.sku),
  qtyOrdered: integer('qty_ordered').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const shipments = pgTable('shipments', {
  id: varchar('id', { length: 16 }).primaryKey(),
  shipDate: date('ship_date'),
  carrier: text('carrier'),
  trackingNumber: text('tracking_number'),
  boxWeightKg: numeric('box_weight_kg', { precision: 10, scale: 2 }),
  status: shipmentStatusEnum('status').notNull().default('preparing'),
  eta: date('eta'),
  actualDelivery: date('actual_delivery'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const shipmentItems = pgTable('shipment_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  shipmentId: varchar('shipment_id', { length: 16 }).notNull().references(() => shipments.id, { onDelete: 'cascade' }),
  orderId: varchar('order_id', { length: 16 }).notNull().references(() => orders.id),
  sku: varchar('sku', { length: 32 }).notNull().references(() => products.sku),
  qty: integer('qty').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const wishlist = pgTable('wishlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  description: text('description').notNull(),
  imageUrl: text('image_url'),
  targetQty: integer('target_qty'),
  supplierPrice: numeric('supplier_price', { precision: 10, scale: 2 }),
  leadTimeDays: integer('lead_time_days'),
  inStock: text('in_stock'),
  notes: text('notes'),
  status: wishlistStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Shipment = typeof shipments.$inferSelect;
export type ShipmentItem = typeof shipmentItems.$inferSelect;
export type WishlistItem = typeof wishlist.$inferSelect;
