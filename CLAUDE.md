# Riptag Ops — Project Context for Claude Code

## What this is

A supplier-operations dashboard for Riptag, a high-volume jewelry resale business operated by Zack (handle: Riptag). The single user-facing problem it solves: tracking purchase orders and shipments with an Alibaba supplier (Miaohong Zhuang) when orders get split across multiple boxes over multiple weeks. The supplier ships partial quantities as inventory becomes available — e.g. 300 pearl watches ordered, 100 in one UPS box, 100 in another, 100 still in production — and chat-based tracking was producing constant confusion.

The app gives both sides a shared source of truth with:
- A branching data model (one order line item → many shipment line items)
- Spreadsheet-style editable tables that feel familiar to a non-English-speaking supplier
- Auto-rolled-up "qty shipped" and "qty owed" derived from raw shipment data
- A dashboard surfacing what needs attention

## Stack

- **Next.js 14** with App Router, TypeScript strict mode, React 18
- **Tailwind CSS** with a custom dark-only theme (no light mode)
- **Postgres** via Railway's built-in addon. Connection string in `DATABASE_URL`.
- **Drizzle ORM** for queries. Schema in `lib/db/schema.ts`.
- **Custom auth** — bcrypt + HTTP-only cookie sessions, no auth library. In `lib/auth.ts`.
- **No third-party services.** No Supabase, no Clerk, no Stripe, no analytics. Self-contained.

## Architecture

- `app/(authed)/` — protected routes (dashboard, orders, shipments, catalog, wishlist). Layout enforces auth via `requireUser()`.
- `app/login/` — unauthenticated entry. Server action in `actions.ts`.
- `app/actions.ts` — every CRUD server action (one file, every mutation). Pages call these directly from client components.
- `app/api/logout/route.ts` — destroys session, clears cookie.
- `lib/db/schema.ts` — Drizzle table definitions and enums.
- `lib/db/queries.ts` — derived/computed queries (e.g. `getOrderItemsFull` which rolls up shipment qty per line item).
- `lib/auth.ts` — session creation/validation, `requireUser()`, `requireOwner()`.
- `components/spreadsheet-table.tsx` — the reusable editable grid powering every page. Click cell → input appears → blur or Enter saves via the `onUpdate` prop.
- `components/sidebar.tsx`, `components/ui.tsx` — nav + atoms (GlassCard, KpiCard, StatusPill, PageHeader).
- `scripts/migrate.ts` — runs on `npm install` via `postinstall`. Creates tables, bootstraps users from env vars, optionally seeds.

## Database schema (high level)

- `users(id, email, password_hash, role)` — role is enum `owner | supplier`
- `sessions(id, user_id, expires_at)`
- `products(sku PK, name, image_url, unit_cost, unit_weight_kg, variation_notes, status)`
- `orders(id PK e.g. "PO-001", order_date, status, shipping_cost, paid, payment_date, notes)`
- `order_items(id, order_id FK, sku FK, qty_ordered, unit_price, notes)`
- `shipments(id PK e.g. "SH-001", ship_date, carrier, tracking_number, status, eta, actual_delivery, notes)`
- `shipment_items(id, shipment_id FK, order_id FK, sku FK, qty, notes)` — **the branching link**
- `wishlist(id, description, target_qty, supplier_price, lead_time_days, in_stock, status)`

Key invariant: `order_items.qty_shipped` is **never stored** — always computed from `SUM(shipment_items.qty WHERE order_id AND sku)`. Same with `qty_remaining` and `fulfillment_status`. See `getOrderItemsFull()` in `lib/db/queries.ts`.

## Roles & permissions

- **Owner** (Zack): full read/write on every table. Can edit catalog, create POs, see everything.
- **Supplier** (Miaohong): can read orders/catalog/wishlist, can write shipments and shipment_items (so he can log boxes as they go out), cannot edit catalog or delete things.

Permissions enforced in `app/actions.ts` via `requireOwner()` or `requireUser()` at the top of each action.

## UI design system

- **Dark only.** `body` background is `#08080A` with a faint radial gradient from `rgba(255,35,0,0.06)` top-left and `rgba(99,102,241,0.04)` bottom-right. Defined in `app/globals.css`.
- **Glass surfaces.** `.glass` and `.glass-strong` utility classes — translucent white overlays with `backdrop-filter: blur(20px) saturate(140%)` and 0.5px borders.
- **Accent color:** `#FF2300` (Riptag red). Used sparingly — CTA buttons, active nav indicator, accent number on KPI cards.
- **Fonts:** Syne (display, num-display class for big numbers), Plus Jakarta Sans (body). Loaded via `<link>` in `app/layout.tsx` to avoid build-time fetching.
- **Status colors:** `ok=#34D399`, `warn=#F59E0B`, `bad=#F87171`, `info=#60A5FA`. Used via `pill-ok` etc. classes and the `<StatusPill>` component which maps status strings to variants in `lib/utils.ts:statusVariant()`.
- **Numbers:** wrap any numeric display in `<span class="num-display">` for tabular-nums Syne with -0.02em letter-spacing.
- **Borders:** always 0.5px, `rgba(255,255,255,0.06)` for default, stronger variants in Tailwind config under `colors.line`.

## Deployment

Target is Railway with built-in Postgres. The project includes `railway.json` configured for Nixpacks.

**Environment variables required:**

```
DATABASE_URL          # injected by Railway when Postgres addon is linked via Reference
SESSION_SECRET        # any 40+ char random string
OWNER_EMAIL           # owner login
OWNER_PASSWORD        # owner login
SUPPLIER_EMAIL        # supplier login
SUPPLIER_PASSWORD     # supplier login
SEED                  # "true" only on first deploy to insert seed data
STORAGE_PATH          # optional, defaults to /data — where catalog images are written
```

**Build vs. runtime split:**
- Build: `npm install && npm run build` (no DB access required)
- Runtime: `npm run db:migrate && npm run start` — `scripts/migrate.ts` runs at startup (DB is reachable then), is idempotent, bootstraps users from env vars, optionally seeds when `SEED=true` AND `products` is empty.

**Required Railway Volume for image uploads:**

Catalog product images are stored on the filesystem at `STORAGE_PATH` (default `/data`). Railway containers are ephemeral, so you MUST mount a persistent Volume at this path or every redeploy will wipe all uploaded images.

One-time setup in Railway dashboard:
1. App service → `Settings` → `Volumes` (or `Storage`)
2. `Create Volume` → mount path: `/data` → pick a size (1 GB is plenty)
3. Save. Railway redeploys with the volume attached.

After this, images written to `/data/catalog/*` persist across deploys. They are served back via the `/api/files/[...path]` route.

## Coding conventions

- **TypeScript strict.** No `any` unless interfacing with raw SQL results — and then immediately narrow to a typed shape.
- **Server actions over API routes** for mutations. New mutations go in `app/actions.ts` and are imported into client components.
- **`'use client'` only when needed** — most pages are server components that fetch data and pass to a small client component for interactivity.
- **No new dependencies without good reason.** The whole point is to stay minimal. Existing deps: bcryptjs, clsx, drizzle-orm, next, pg, react, tabler-icons-react, tailwind-merge. Add nothing else without discussing.
- **Database access only via `lib/db/`.** Never import `pg` directly in app code.
- **Revalidate paths after mutations.** Every server action calls `revalidatePath('/relevant-route')` so the UI updates.
- **Never store derived data.** Always compute it. The `getOrderItemsFull()` pattern is the model.

## Communication style for this user

Riptag is technical (has built his own Chrome extensions, scrapers, SaaS products on Railway + Supabase + Playwright). Skip beginner explanations. He prefers:
- Short, direct, confident answers
- No groveling, no "great question," no excessive caveats
- Code paste-ready, equations first, steps second, final answer last
- Push back when he's wrong about something technical, but stay constructive
- Match his energy — he curses, he's blunt; respond in kind but stay professional

He runs a real business — every change has to actually work, not "should work." If something is risky, say so and offer alternatives.

## What you might be asked to do

- Debug Railway deploy failures (check `DATABASE_URL` reference, env vars present, build logs)
- Add a feature (e.g. CSV export, email notifications via Resend, image upload via UploadThing)
- Tweak the UI (more or less glass, different accent intensity, sidebar collapse)
- Migrate data from his existing Supabase setup or Google Sheets
- Connect to his existing Hivemind / Listley / Raghouse infrastructure
- Add the supplier message workflow (inbound emails from Miaohong → auto-create wishlist rows)

When in doubt about scope, ask. When in doubt about implementation, prefer the simplest approach that works.

## Current deployment status (last known)

- Code uploaded to GitHub repo `riptag-ops`
- Railway project created, GitHub App access being configured
- Postgres addon and env vars not yet added — that's the immediate next step
- First successful deploy hasn't happened yet
