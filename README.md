# Wolf Car — website, staff dashboards and showroom ordering

This repository contains:

| Part | Where | What |
|---|---|---|
| **Website** | `app/[locale]/page.tsx`, `components/` | The public landing page (Arabic/English). Unchanged except for two footer links: **Product catalog** and **Staff login**. |
| **Public catalog** | `app/[locale]/products` | All products with image, name and description only. Prices and barcodes never leave the API here. |
| **Staff dashboards** | `app/[locale]/(app)/(staff)` | One login for everyone; the account's role decides the landing page. Products, pricing, orders, users, branches, permissions, activity log, account security. |
| **Showroom kiosk** | `app/[locale]/(app)/showroom` | Touch screen in each branch: customers pick products, staff submits the order. Own login and session. |
| **API** | `api/` | NestJS 12 + PostgreSQL (Prisma 7). Auth, RBAC, orders, receipts (PDF), audit log. Swagger at `/api/docs`. |
| **Shared rules** | `shared/` | Permission keys, roles and validation rules used by both the API and the web app. |

```
browser ──► Next.js (web, :3000) ──/api/* rewrite──► NestJS API (:4000) ──► PostgreSQL
                │  landing · catalog · dashboards · showroom      │  auth · RBAC · orders · PDF receipts
```

The browser only ever talks to the Next.js origin; `/api/*` is proxied to the API, so the auth cookies are first‑party.

---

## 1. Requirements

- Node.js **22** (22.12 or newer) and npm
- PostgreSQL 17 — easiest with Docker (`docker compose`)
- Chromium for PDF receipts — for local development run `npx playwright install chromium` once (the Docker image ships Debian's Chromium)

## 2. Quick start (local development)

```bash
# 1. databases (dev on :5432, throwaway test DB on :5433)
docker compose up -d db db-test

# 2. API
cd api
cp .env.example .env          # then set JWT_ACCESS_SECRET and TOTP_ENCRYPTION_KEY (commands are in the file)
npm install
npx prisma migrate deploy     # create the schema
npm run db:seed               # demo accounts and branches (wipes the dev database!)
npm run db:import-legacy      # the real catalogue, from ../old products data
npm run start:dev             # http://localhost:4000/api  (Swagger: /api/docs)

# 3. web (in another terminal, repo root)
npm install
npx playwright install chromium   # also used by the API to print receipts
npm run dev                       # http://localhost:3000
```

Open http://localhost:3000/ar (Arabic, default) or http://localhost:3000/en.
Staff sign-in: `/ar/login` · Showroom: `/ar/showroom` · Catalog: `/ar/products`.

### Everything in Docker

```bash
cp api/.env.example api/.env   # set the two secrets
docker compose up -d --build    # db, db-test and the API on :4000 (migrations run on start)
docker compose exec api npx tsx prisma/seed.ts   # optional demo accounts (wipes the database)
API_INTERNAL_URL=http://localhost:4000 npm run build && npm start   # web on :3000
```

### Testing from other devices (phone, laptop)

Devices on the same Wi-Fi only need to reach the web app, because Next.js proxies `/api/*` to the API on this machine.

1. In `api/.env`, set `COOKIE_SECURE=false` and restart the API. Browsers drop `Secure` cookies over plain `http://` on any host except `localhost`, so without this, signing in fails silently.
2. Run `npm run dev` and open the **Network:** URL it prints (for example `http://192.168.1.34:3000`) on the other device. `next.config.ts` adds this machine's LAN IPs to `allowedDevOrigins` when the server starts. If your IP changes, restart `npm run dev`.
3. If the page doesn't load at all, allow incoming connections for `node` in the macOS firewall.

Over `http://<LAN IP>`, copy-to-clipboard buttons don't work, because the browser allows clipboard access only on `localhost` and HTTPS.

## 3. Importing the legacy catalogue

The previous Supabase catalogue exports as two CSVs (`categories_rows.csv`,
`products_rows.csv`) whose images are inline base64 data URIs. To load them:

```bash
cd api
npm run db:import-legacy                       # reads ../old products data
npm run db:import-legacy -- --dir /path/to/csvs
npm run db:import-legacy -- --force-images     # re-encode product images that already exist
```

Category (car) images are always re-encoded, with their empty margins trimmed
so every car fills its card the same way, and get their English name for the
/en pages from `CATEGORY_NAMES_EN` in `api/src/legacy-import/legacy-rows.ts`
(add a line there for a new category).

Unlike the seed, the import **never wipes anything**. Rows are keyed on their
legacy primary keys (`cat-…`, `prod-…`) in the `legacy_id` columns, so
re-running updates what is already there instead of duplicating it. Products
are appended to every active branch's showroom order, after whatever the branch
manager has already arranged.

What it does to the data on the way in:

- **Images** are decoded and re-encoded through the same pipeline as an upload,
  producing `<uuid>.webp` and `<uuid>-sm.webp` in `UPLOAD_DIR`. The source
  pictures are small (often under 200 px), so they are never enlarged — see the
  note on `Product.imageKey` in the schema.
- **Arabic text** is NFKC-normalised. The export stores much of it as
  Presentation Forms-B (`ﻟﻴﻮﺑﺎرد`), which renders inconsistently and never
  matches what a user types into search; NFKC folds it to `ليوبارد`.
- **Barcodes** are kept as-is, including duplicates. The legacy catalogue lists
  the same part once per car model, so ~147 barcodes are shared by several
  products — `products.barcode` is therefore indexed, not unique. A value that
  is not a usable barcode is dropped with a warning.
- **Rows without a usable image are skipped**, because `image_key` is NOT NULL
  and a product with no picture is useless on the kiosk.

Every change and skip is printed as a warning at the end of the run.

## 4. Demo accounts (created by the seed — development only)

| Username | Role | Dashboard password | Showroom password |
|---|---|---|---|
| `admin` | Super Admin | `SuperWolf#2026!` | — |
| `finance` | Finance | `Ledger#Wolf2026!` | — |
| `bo.manager` | Branch Manager, Bin Omran | `Manager#Wolf2026!` | `Showroom#2026!` |
| `bo.cashier` | Cashier, Bin Omran | `Cashier#Wolf2026!` | `Showroom#2026!` |
| `gh.manager` | Branch Manager, Al Gharrafa | `Manager#Wolf2026!` | `Showroom#2026!` |
| `gh.cashier` | Cashier, Al Gharrafa | `Cashier#Wolf2026!` | `Showroom#2026!` |

The seed creates no products: the catalogue comes from `npm run db:import-legacy` (`npm run db:reset` runs both). Only the Playwright suite sets `SEED_DEMO_CATALOG=1`, which adds 13 made-up products (2 without a price, to show Finance's queue), a different showroom order per branch and a few orders. **Never run the seed in production** — it empties the database first (it refuses to run when `NODE_ENV=production`).

There is no public registration: the Super Admin creates every account. New accounts get an auto-generated username (e.g. `wk.cashier`) and generated passwords that are shown **once** in a copyable dialog.

## 5. Environment variables

### API (`api/.env`, validated at startup — the API refuses to start with a bad value)

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `4000` | HTTP port |
| `LOG_LEVEL` | `info` | pino level (`silent` … `trace`) |
| `CORS_ORIGINS` | — (required) | Comma-separated browser origins allowed by CORS |
| `TRUST_PROXY` | `loopback` | Express `trust proxy` (client IPs in the audit log). Docker: `loopback, uniquelocal` |
| `SWAGGER_ENABLED` | `false` | Serve Swagger UI at `/api/docs` |
| `DATABASE_URL` | — (required) | PostgreSQL URL |
| `TEST_DATABASE_URL` | — | API e2e tests only; its name must contain `test` |
| `E2E_DATABASE_URL` | — | Playwright tests only; its name must contain `e2e` |
| `JWT_ACCESS_SECRET` | — (required, ≥ 32 chars) | Signs access tokens |
| `JWT_ACCESS_TTL_SECONDS` | `900` | Access token lifetime (15 min) |
| `REFRESH_TTL_DAYS` | `7` | Dashboard session lifetime |
| `SHOWROOM_SESSION_TTL_HOURS` | `16` | Showroom session lifetime |
| `COOKIE_SECURE` | `true` | `Secure` flag on cookies (browsers accept it on `http://localhost`, not on a LAN IP; see "Testing from other devices") |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES` | `5` / `15` | Account lockout |
| `RATE_LIMIT_PER_MINUTE` | `300` | General per-IP budget |
| `AUTH_THROTTLE_LIMIT` / `AUTH_THROTTLE_TTL_SECONDS` | `10` / `60` | Per-IP budget on sign-in and security endpoints |
| `TOTP_ENCRYPTION_KEY` | — (required, 32 bytes base64) | AES-256-GCM key for 2FA secrets at rest |
| `TOTP_ISSUER` | `Wolf Car` | Name shown in authenticator apps |
| `UPLOAD_DIR` | `./storage/uploads` | Product images (processed WebP files) |
| `CHROME_PATH` | — | Chromium for receipts; empty = Playwright's browser |

### Web

| Variable | Default | Purpose |
|---|---|---|
| `API_INTERNAL_URL` | `http://localhost:4000` | Where the Next.js server reaches the API (`/api/*` rewrite and the catalog page). Read at **build** time for the rewrite. |

## 6. Tests

```bash
# API — unit tests (no database)
cd api && npm test

# API — end-to-end (Supertest + real PostgreSQL on TEST_DATABASE_URL)
docker compose up -d db-test
cd api && npm run test:e2e

# Web — component/hook tests (Vitest + Testing Library + MSW)
npm test

# Browser — full flows (Playwright; production builds on :3100/:4100, database E2E_DATABASE_URL)
docker compose up -d db-test          # also creates the wolfcar_e2e database
npx playwright install chromium                                                               # once
npm run e2e:build                     # builds with API_INTERNAL_URL=http://localhost:4100 (rewrites are fixed at build time)
npm run test:e2e                      # migrates + reseeds wolfcar_e2e, starts both servers, runs the browser tests
```

Landing snapshots live in `e2e/landing.spec.ts-snapshots/`. They were checked pixel-identical to the reviewed page; only regenerate them (`npx playwright test e2e/landing.spec.ts --update-snapshots`) after an intentional, reviewed landing change.

What they cover:

- **API unit** — every service, guard, interceptor and filter (auth, tokens, lockout, 2FA, RBAC, users, branches, products, pricing, orders, showroom, receipts, activity log).
- **API e2e** — the test database's default time zone is set to Asia/Qatar, so the suite also proves timestamps are stored as true UTC instants. Every endpoint for every role: a table-driven **RBAC matrix** checks all routes × {anonymous, Super Admin, Finance, Manager, Cashier, showroom session}. Plus the forbidden paths: Finance editing name/image/barcode/description (403 on the route, 400 for smuggled fields), managers setting prices, cashiers editing confirmed orders (409), cross-branch reads/writes/receipts (404), public catalogue field leakage, 2FA (setup, login, replay, recovery codes, admin reset), rate limiting (429) and lockout (423), refresh-token reuse, upload spoofing/oversize, database constraints (second manager, branch without cashier, append-only log), and an **audit-coverage** test that fails if any state-changing route is not audited.
- **Web** — forms (login/2FA, products, prices, passwords with strength meter, users, branches), permission-gated UI, the showroom cart and checkout, drag-and-drop reordering.
- **Playwright** — the complete story (admin creates a branch and its staff → manager adds a product → finance prices it → showroom places an order → cashier confirms and downloads the receipt → admin sees it all in the activity log), role landing pages, the public catalogue (no prices in DOM or network), and **visual snapshots of the landing page**.

## 7. Permission model

**Roles** (`SUPER_ADMIN`, `FINANCE`, `BRANCH_MANAGER`, `CASHIER`) map to **granular permissions stored in the database**. The Super Admin edits them on *Dashboard → Permissions*:

- **By role** — the default set for everyone with that role.
- **By user** — per-user exceptions: *Grant* or *Revoke* on top of the role.

Effective permissions = role permissions + user grants − user revokes, **resolved on every request**, so a revocation applies immediately. `SUPER_ADMIN` always has every permission and cannot be edited (so nobody can lock the system out). The web app hides or disables what the user can't do, but that is only for convenience: **the API is the source of truth** (`@RequirePermissions(...)` guards on every route).

| Permission | What it allows | Default roles |
|---|---|---|
| `product.create` | Create products (name, image, barcode, description — never a price) | Manager |
| `product.update.details` | Edit name, image, barcode, description | Manager |
| `product.update.price` | Set/change prices (price only; history recorded) | Finance |
| `product.read` | View products, prices (read-only) and price history | Finance, Manager |
| `product.reorder` | Drag-and-drop the branch's showroom order | Manager |
| `order.create` | Place orders from the showroom | Manager, Cashier |
| `order.read.branch` | View own branch's orders | Manager, Cashier |
| `order.read.all` | View every branch's orders | Finance |
| `order.update` | Edit pending orders | Cashier |
| `order.cancel` | Cancel pending orders | Cashier |
| `order.confirm` | Confirm orders (then immutable except for Super Admin) | Cashier |
| `order.receipt.download` | Download PDF receipts | Cashier |
| `user.manage` | Create/manage accounts, reset passwords and 2FA | — |
| `branch.manage` | Create/manage branches, replace staff | — |
| `permission.manage` | Edit role and user permissions | — |
| `activity.read` | View the activity log | — |
| `showroom.password.view_or_change` | Change own showroom password | Manager, Cashier |

(“—” = Super Admin only by default.)

**Branch isolation.** Branch Managers and Cashiers belong to exactly one branch. Every branch-scoped query in the API is filtered by the signed-in user's branch in the service layer, so another branch's order behaves exactly like a missing one (404), whatever ids or filters are sent. The showroom never trusts the client with the branch: it comes from the signed-in showroom user.

**Branch staffing is enforced by the database**: partial unique indexes allow at most one (non-deleted) manager and one cashier per branch, and a deferred constraint trigger requires at least one of each at commit. That's why a branch is created together with its two accounts, and staff are *replaced* (old account retired and new one created in one transaction) rather than added.

## 8. Security notes

- **Passwords**: argon2id (19 MiB, t=2, p=1); never stored or returned in plain text. Policy (shared by API and web): ≥ 12 characters, upper, lower, number, symbol, not containing the username; live strength meter in the UI.
- **Sessions**: 15-minute JWT access token kept in memory only; opaque refresh token (stored hashed) in an `httpOnly; Secure; SameSite=Strict` cookie scoped to `/api/auth`, rotated on every use, with reuse detection that revokes the session. Logout, password change, admin reset and deactivation revoke sessions immediately. The showroom uses a separate cookie, password and session type that cannot reach dashboard routes.
- **2FA**: TOTP (QR setup, verified before activation), secrets AES-256-GCM encrypted, replayed codes rejected, 10 single-use recovery codes shown once; the Super Admin can reset a user's 2FA.
- **Brute force**: per-IP rate limits (strict on sign-in/security endpoints) and account lockout after 5 failures for 15 minutes — unknown usernames are locked the same way, so lockouts don't reveal which usernames exist.
- **HTTP**: Helmet (CSP, nosniff, frame-ancestors none…), strict CORS allowlist, CSRF header on cookie-authenticated endpoints, request ids on every response and log line, global validation with `whitelist` + `forbidNonWhitelisted`, error responses that never include stack traces or driver messages.
- **Uploads**: images are checked by content (magic bytes + real decode), size-limited (5 MB), re-encoded to WebP (EXIF stripped) and stored under random UUID names; served with `nosniff` and a locked-down CSP.
- **Receipts**: rendered from an escaped template by Chromium with JavaScript disabled and no network access.
- **Audit log**: an interceptor records every state-changing request (and receipt downloads, sign-ins, failed sign-ins, permission denials) with actor, role, branch, action, entity, before/after (secrets redacted), IP, user agent and request id. The table is append-only (a trigger blocks UPDATE/DELETE), and a test fails if a new state-changing route isn't audited.

## 9. Database notes

- Schema: `api/prisma/schema.prisma`. Migrations: `api/prisma/migrations/` (apply with `npx prisma migrate deploy`).
- Hand-written SQL at the end of the first migration adds what Prisma can't model: the branch staffing indexes and trigger, CHECK constraints (role ↔ branch, money, quantities, line totals), the deferrable `(branch, position)` unique constraint for reordering, and the append-only activity log. When generating a new migration, review it for accidental `DROP`s of these objects.
- Order lines snapshot the product **name and unit price** at order time; later price or name changes never alter existing orders or receipts.
- `npm run db:reset` (in `api/`) recreates the dev database, reseeds the accounts and re-imports the legacy catalogue.

## 10. Project structure

```
app/[locale]/page.tsx              landing page (unchanged)
app/[locale]/products/             public catalogue
app/[locale]/(app)/(staff)/login   staff sign-in
app/[locale]/(app)/(staff)/dashboard/…   overview, products, orders, users, branches, permissions, activity, account
app/[locale]/(app)/showroom/…      showroom sign-in + kiosk
components/                        landing page components (+ ui/ = shadcn/ui re-themed, app/ = shared app components)
features/                          dashboard/showroom feature code (one folder per area)
lib/                               API client, formatting, i18n helpers, motion presets
messages/{ar,en}.json              website texts · messages/app/{ar,en}/ = dashboard & showroom texts
shared/                            permissions + validation rules (web and API)
api/src/                           NestJS modules: auth, account, rbac, users, branches, products, uploads,
                                   showroom, orders, receipts, activity, public
api/test/                          API end-to-end tests · e2e/ = Playwright tests
```

---

## Landing page notes (original)

The notes below describe rules for the landing page and still apply.

## قواعد لازم تتحافظ عليها

**1. الـ hero مثبّت فيزيائيًا، مش منطقيًا.**
الكلام على **اليمين** والفان على **الشمال** بغضّ النظر عن اتجاه النص. يعني
`ml-auto` و `border-r` و `left-*` — مش `ms-auto` ولا `border-e` ولا `start-*`.
الخصائص المنطقية بتنقلب تحت `dir="rtl"` وبتودّي الكلام ناحية الشمال.
(الأقسام التانية منطقية عادي — بس الـ hero لأ.)

**2. شريط الماركات: 4 نسخ والحركة `-25%`.**
الحركة لازم تساوي عرض نسخة واحدة بالظبط. نسختين بس بتسيب **فراغ** لما المسار
يعدّي عرض الشاشة، وده بيبان كأن الشريط واقف بيستنى.
الشرط: `عرض المسار − مسافة الحركة ≥ عرض الشاشة` (دلوقتي: لحد 3539px).

**3. لوجوهات الشريط `loading="eager"`.**
`next/image` بيعمل lazy تلقائيًا. الشريط بيتحرك بـ `transform` مش scroll، فالنسخ
اللي بره الشاشة ممكن تفضل فاضية وهي بتلف.

**4. رسايل واتساب لازم تعدّي على `encodeURIComponent`.**
ده في `waLink()`. الموقع القديم كان مش بيعمل كده، وأي `&` في اسم الخدمة كان
**بيقطع الرسالة** فتوصل ناقصة.

**5. الأنيميشن CSS خالص.** مفيش مكتبات أنيميشن في صفحة الهبوط. `@keyframes` + `transform` بس. (Motion مستخدمة في لوحات التحكم والمعرض فقط، ومش بتتحمّل في صفحة الهبوط.)

**6. التباين.** لوجوهات الشريط عليها `opacity-60`، فألوان النصوص جواه مرفوعة
(`#C8C8C8`) عشان تفضل فوق 4.5:1 بعد الشفافية.

## ناقص — مش مشاكل كود

- **لوجو نيسان** — متعرض كنص لحد ما يوصل ملف PNG أبيض بخلفية شفافة (`lib/content.ts`)
- **صور حقيقية** — كل الصور دلوقتي مربعات رمادية (`<Photo/>`)
- **3 تقييمات Google** — ⛔ ممنوع تتخترع، لازم تتنسخ من جوجل
- **لوجو PayLater** — الموجود رسمة مؤقتة في `Catalog.tsx`
- **النسخة الإنجليزي** — زرار EN شكل بس
