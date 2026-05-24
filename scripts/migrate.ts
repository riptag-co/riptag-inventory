import 'dotenv/config';
import { Pool } from 'pg';

const SCHEMA_SQL = `
do $$ begin
  create type user_role as enum ('owner','supplier');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('draft','pending_payment','paid','in_production','partial_shipped','fully_shipped','complete','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shipment_status as enum ('preparing','shipped','in_transit','out_for_delivery','delivered','received','delayed','lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type product_status as enum ('active','discontinued');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wishlist_status as enum ('open','promoted','rejected');
exception when duplicate_object then null; end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email varchar(256) not null unique,
  password_hash text not null,
  role user_role not null default 'supplier',
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists products (
  sku varchar(32) primary key,
  name text not null,
  image_url text,
  unit_cost numeric(10,2) not null default 0,
  unit_weight_kg numeric(10,3) not null default 0,
  variation_notes text,
  status product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id varchar(16) primary key,
  order_date date not null default current_date,
  status order_status not null default 'draft',
  shipping_cost numeric(10,2) not null default 0,
  paid boolean not null default false,
  payment_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id varchar(16) not null references orders(id) on delete cascade,
  sku varchar(32) not null references products(sku),
  qty_ordered integer not null,
  unit_price numeric(10,2) not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists shipments (
  id varchar(16) primary key,
  ship_date date,
  carrier text,
  tracking_number text,
  box_weight_kg numeric(10,2),
  status shipment_status not null default 'preparing',
  eta date,
  actual_delivery date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id varchar(16) not null references shipments(id) on delete cascade,
  order_id varchar(16) not null references orders(id),
  sku varchar(32) not null references products(sku),
  qty integer not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists wishlist (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  image_url text,
  target_qty integer,
  supplier_price numeric(10,2),
  lead_time_days integer,
  in_stock text,
  notes text,
  status wishlist_status not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists order_items_sku_idx on order_items(sku);
create index if not exists shipment_items_shipment_idx on shipment_items(shipment_id);
create index if not exists shipment_items_order_sku_idx on shipment_items(order_id, sku);
create index if not exists sessions_user_idx on sessions(user_id);
`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL set — skipping migration.');
    return;
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Running migrations...');
    await pool.query(SCHEMA_SQL);
    console.log('✓ Schema ready.');

    // One-time data fix: any draft orders still using the old PO-XXX numbering
    // get renamed to DRAFT-XXX so PO numbers stay reserved for confirmed orders.
    // Idempotent — once renamed, the query finds nothing on subsequent runs.
    const stragglerDrafts = await pool.query<{ id: string }>(
      "select id from orders where status = 'draft' and id like 'PO-%' order by id"
    );
    if (stragglerDrafts.rows.length > 0) {
      console.log(`Renaming ${stragglerDrafts.rows.length} legacy PO-* draft(s) to DRAFT-*...`);

      const maxRes = await pool.query<{ max_n: string }>(
        "select coalesce(max(substring(id from 7)::int), 0)::text as max_n from orders where id like 'DRAFT-%'"
      );
      let nextN = parseInt(maxRes.rows[0]?.max_n ?? '0', 10) + 1;

      await pool.query('BEGIN');
      try {
        for (const row of stragglerDrafts.rows) {
          const oldId = row.id;
          const newId = `DRAFT-${String(nextN).padStart(3, '0')}`;
          nextN++;

          await pool.query(
            `insert into orders (id, order_date, status, shipping_cost, paid, payment_date, notes, created_at, updated_at)
             select $1, order_date, status, shipping_cost, paid, payment_date, notes, created_at, updated_at
             from orders where id = $2`,
            [newId, oldId]
          );
          await pool.query('update order_items set order_id = $1 where order_id = $2', [newId, oldId]);
          await pool.query('update shipment_items set order_id = $1 where order_id = $2', [newId, oldId]);
          await pool.query('delete from orders where id = $1', [oldId]);
          console.log(`  ${oldId} → ${newId}`);
        }
        await pool.query('COMMIT');
        console.log('✓ Draft renumber complete.');
      } catch (e) {
        await pool.query('ROLLBACK');
        throw e;
      }
    }

    const result = await pool.query<{ count: string }>('select count(*)::text as count from users');
    const userCount = parseInt(result.rows[0].count, 10);

    if (userCount === 0) {
      console.log('No users found — bootstrapping from env vars...');
      const bcrypt = require('bcryptjs');

      const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
      const ownerPassword = process.env.OWNER_PASSWORD;
      const supplierEmail = process.env.SUPPLIER_EMAIL?.toLowerCase();
      const supplierPassword = process.env.SUPPLIER_PASSWORD;

      if (ownerEmail && ownerPassword) {
        const hash = await bcrypt.hash(ownerPassword, 10);
        await pool.query(
          'insert into users (email, password_hash, role, display_name) values ($1, $2, $3, $4) on conflict (email) do nothing',
          [ownerEmail, hash, 'owner', 'Riptag']
        );
        console.log(`✓ Created owner: ${ownerEmail}`);
      }
      if (supplierEmail && supplierPassword) {
        const hash = await bcrypt.hash(supplierPassword, 10);
        await pool.query(
          'insert into users (email, password_hash, role, display_name) values ($1, $2, $3, $4) on conflict (email) do nothing',
          [supplierEmail, hash, 'supplier', 'Supplier']
        );
        console.log(`✓ Created supplier: ${supplierEmail}`);
      }
    } else {
      console.log(`Found ${userCount} existing users, skipping bootstrap.`);
    }

    const seedNeeded = await pool.query<{ count: string }>('select count(*)::text as count from products');
    if (parseInt(seedNeeded.rows[0].count, 10) === 0 && process.env.SEED === 'true') {
      console.log('Seeding sample data...');
      await pool.query(`
        insert into products (sku, name, unit_cost, unit_weight_kg, variation_notes) values
          ('PW-001','Pearl Watch — Gold',2.80,0.040,'Standard pearl band'),
          ('PW-002','Pearl Watch — Premium',3.20,0.045,'Higher-quality pearl, NOT the cheap version'),
          ('GW-001','Gem Watch',3.50,0.040,'Gemstone face'),
          ('CB-001','Centipede Bracelet — Gold',1.90,0.050,''),
          ('CN-001','Centipede Necklace — Gold',1.70,0.040,''),
          ('HB-001','Heart Bracelet — Pink',1.20,0.012,'Pink heart charm w/ stones'),
          ('GA-001','Gold Anklet w/ Leaf Pendant',0.50,0.010,''),
          ('GFB-001','Gold Fish Bangle',1.50,0.050,''),
          ('BP-001','Blue Gem Pendant',1.30,0.015,'Blue rectangular stone on cuban chain'),
          ('SN-001','Stone Bead Necklace w/ Stars',1.30,0.040,'Multicolor stone beads, star charms'),
          ('LB-001','"live" Bracelet — Rose Quartz',1.10,0.050,'Cuff style w/ rose quartz ends'),
          ('VP-001','Vintage Oval Pendant',1.40,0.020,'Aged silver finish')
        on conflict (sku) do nothing;

        insert into orders (id, order_date, status, shipping_cost, paid, payment_date, notes) values
          ('PO-001','2026-05-18','complete',240.00,true,'2026-05-18','First reorder batch'),
          ('PO-002','2026-05-20','partial_shipped',320.00,true,'2026-05-20','Pearl watches priority — buyer waiting'),
          ('PO-003','2026-05-22','pending_payment',801.90,false,null,'Large reorder — yellow items new')
        on conflict (id) do nothing;

        insert into order_items (order_id, sku, qty_ordered, unit_price, notes) values
          ('PO-001','PW-001',300,2.80,'Initial pearl watch order'),
          ('PO-001','CB-001',100,1.90,''),
          ('PO-001','HB-001',100,1.20,''),
          ('PO-001','GA-001',100,0.50,''),
          ('PO-002','PW-001',300,2.80,'URGENT — buyer waiting'),
          ('PO-002','BP-001',300,1.30,''),
          ('PO-002','CN-001',300,1.70,''),
          ('PO-003','PW-002',200,3.20,'NEW — premium pearl version'),
          ('PO-003','HB-001',100,1.20,''),
          ('PO-003','GFB-001',100,1.50,''),
          ('PO-003','GA-001',100,0.50,''),
          ('PO-003','GW-001',100,3.50,'');

        insert into shipments (id, ship_date, carrier, tracking_number, box_weight_kg, status, eta, actual_delivery, notes) values
          ('SH-001','2026-05-20','UPS','1ZG798750432207146',6.5,'received','2026-05-25','2026-05-23','Box 1 of 3 from PO-002'),
          ('SH-002','2026-05-20','UPS','1ZG798750429944758',6.2,'in_transit','2026-05-25',null,'Box 2 of 3 from PO-002'),
          ('SH-003','2026-05-20','UPS','1ZG798750423893565',5.8,'in_transit','2026-05-25',null,'Box 3 of 3 from PO-002'),
          ('SH-004','2026-05-21','UPS','1ZG798750445812003',12.4,'in_transit','2026-05-26',null,'Centipede + blue pendant batch')
        on conflict (id) do nothing;

        insert into shipment_items (shipment_id, order_id, sku, qty, notes) values
          ('SH-001','PO-001','PW-001',100,'PO-001 pearl batch 1'),
          ('SH-001','PO-001','CB-001',100,''),
          ('SH-001','PO-001','HB-001',100,''),
          ('SH-001','PO-001','GA-001',100,''),
          ('SH-001','PO-002','PW-001',100,'First batch from PO-002'),
          ('SH-002','PO-002','PW-001',100,'Second batch from PO-002'),
          ('SH-003','PO-002','CN-001',200,''),
          ('SH-004','PO-002','BP-001',300,'Blue pendants — full qty shipped together'),
          ('SH-004','PO-002','CN-001',100,'');

        insert into wishlist (description, target_qty, supplier_price, lead_time_days, in_stock, status) values
          ('Silver chain w/ rose pendant',200,null,null,'unknown','open'),
          ('Butterfly anklet — gold',150,0.70,12,'yes','open'),
          ('Tennis bracelet — gold/CZ',100,null,null,'unknown','open');
      `);
      console.log('✓ Seed data inserted.');
    }
  } catch (e: any) {
    console.error('Migration error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
