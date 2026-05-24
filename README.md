# Riptag Ops

Supplier operations dashboard. Built for tracking purchase orders, shipments, and inventory in transit between Riptag and the Alibaba supplier (Miaohong).

**Stack**: Next.js 14 · Postgres · Tailwind · Drizzle ORM · session-based auth

---

## Deploy to Railway (3 steps)

### 1. Push this folder to GitHub

```bash
cd riptag-ops
git init
git add .
git commit -m "initial commit"
gh repo create riptag-ops --private --source=. --push
```

(Or do it through the GitHub web UI — make a new private repo and push.)

### 2. Create the Railway project

1. Go to [railway.app/new](https://railway.app/new) → "Deploy from GitHub repo" → pick `riptag-ops`
2. While it's setting up, click **+ New** → **Database** → **Add PostgreSQL**. Railway connects it automatically.
3. Wait for the first deploy. It'll fail — that's expected, because env vars aren't set yet.

### 3. Set environment variables

In the Railway project → click your Next.js service → **Variables** → add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Click "Reference" → pick the Postgres service → `DATABASE_URL` |
| `SESSION_SECRET` | Any random 64-char string (`openssl rand -hex 32`) |
| `OWNER_EMAIL` | Your email (e.g. `zack@riptag.co`) |
| `OWNER_PASSWORD` | Strong password — this is your login |
| `SUPPLIER_EMAIL` | Miaohong's email |
| `SUPPLIER_PASSWORD` | Strong password — give this to Miaohong |
| `SEED` | `true` (only for first deploy — set to `false` after) |

Click **Deploy**. Takes ~2 minutes. When the green check appears, click the URL — you're in.

### After first deploy

- Change `SEED` to `false` (so subsequent deploys don't try to re-seed)
- Add a custom domain in Railway → Settings → Networking (use `ops.riptag.co` or similar)
- Both you and Miaohong can now sign in at the URL with the credentials you set

---

## Local development

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL to a local Postgres or a free Neon/Railway one
npm install
npm run db:push
npm run db:seed
npm run dev
```

Visit `http://localhost:3000` → sign in with the OWNER credentials from `.env`.

---

## Architecture

- **Owner** (you) — full read/write everywhere. Can edit catalog, create POs, manage everything.
- **Supplier** (Miaohong) — can edit shipments and shipment contents, view orders/catalog/wishlist (read-only on catalog).
- Database is inside Railway. No third-party services. No exposed API keys.
- All passwords are bcrypt-hashed. Sessions are HTTP-only cookies.

## File map

```
app/
  (authed)/         protected routes — sidebar layout, auth check
    dashboard/      KPIs + recent activity
    orders/         order list + detail with branching
    shipments/      every box, every tracking number
    catalog/        master product list
    wishlist/       future ordering ideas
  login/            unauthenticated login page
  api/logout/       session destroy endpoint
  actions.ts        all server actions (CRUD)
lib/
  db/               schema + queries
  auth.ts           bcrypt + cookie sessions
components/
  sidebar.tsx       nav
  spreadsheet-table.tsx   editable grid used everywhere
  ui.tsx            cards, pills, headers
scripts/
  migrate.ts        runs on `npm install` — creates tables and bootstrap users
```
