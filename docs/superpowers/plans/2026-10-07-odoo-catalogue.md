# Odoo Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the legacy products and fill the catalogue from Odoo with a hand-run import command, previewed on the local database only.

**Architecture:** A migration adds `products.is_active`, `products.odoo_id` and `categories.odoo_id`. The showroom, public catalogue and dashboard list filter on `isActive`. A new `api/src/odoo/` folder holds a small JSON-RPC client and pure row-mapping functions; `api/prisma/import-odoo.ts` is the command, modelled on `api/prisma/import-legacy.ts`.

**Tech Stack:** NestJS 12, Prisma 7 (Postgres 17), Jest (unit: `npm test`, e2e: `npm run test:e2e`), sharp, Node 22 `fetch`. All commands run from `api/`.

**Spec:** `docs/superpowers/specs/2026-10-07-odoo-catalogue-design.md`

## Global Constraints

- Read only: the app never writes to Odoo. Only `search_read` and `read` are called.
- Nothing is deleted. Products and categories are only switched off (`isActive = false`).
- An Odoo variant is imported only when it is active, `sale_ok`, not `type = 'service'`, not under an `Expenses` category, and `lst_price > 1`.
- Local database only. Do not run the import against production, and do not deploy.
- The migration only adds columns; it hides nothing.
- No frontend (Next.js) file changes.
- `api/.env` holds the Odoo credentials and is git-ignored. Never print or commit `ODOO_API_KEY`.
- Odoo endpoint: `POST {ODOO_URL}/jsonrpc` (verified working on `https://erp-test.wolf-groups.com`, database `wolf_group_test_db`).
- Lint is strict: `npm run lint` (oxlint, `--deny-warnings`) and `npm run typecheck` must pass before each commit.

## Review Focus

1. **Odoo answers with HTML instead of JSON** (nginx 502, wrong URL) → the command stops with a readable message and writes nothing. Pinned in Task 4.
2. **Wrong API key** (`authenticate` returns `false`) → stops with "Odoo rejected the login", writes nothing. Pinned in Task 4.
3. **A reorder from the dashboard while hidden products exist in the branch** → succeeds; hidden products keep a place after the active ones. Pinned in Task 2.
4. **An Odoo barcode the app's rules reject** (spaces, symbols) → product is imported without a barcode and the warning is listed. Pinned in Task 3.
5. **An Odoo product with no category** (`categ_id: false`) → imported with no category rather than crashing. Pinned in Task 3.

---

### Task 1: Schema and migration

**Files:**
- Modify: `api/prisma/schema.prisma` (models `Category`, `Product`)
- Create: `api/prisma/migrations/20261007100000_odoo_catalogue/migration.sql`

**Interfaces:**
- Produces: Prisma fields `Product.isActive: boolean`, `Product.odooId: number | null` (unique), `Category.odooId: number | null` (unique).

- [ ] **Step 1: Edit the schema**

In `model Category`, after the `legacyId` line add:

```prisma
  /// Id of the Odoo product category (product.category) this row was imported from.
  odooId    Int?     @unique @map("odoo_id")
```

In `model Product`, after the `legacyId` line add:

```prisma
  /// Id of the Odoo variant (product.product) this row was imported from, so
  /// re-running the Odoo import updates rows instead of duplicating them.
  odooId         Int?      @unique @map("odoo_id")
  /// False hides the product from the showroom, the website and the dashboard
  /// list. Rows are never deleted: past orders still point at them.
  isActive       Boolean   @default(true) @map("is_active")
```

- [ ] **Step 2: Write the migration**

`api/prisma/migrations/20261007100000_odoo_catalogue/migration.sql`:

```sql
-- Odoo becomes the catalogue's source. Adds the link columns and a "hidden"
-- switch. Hides nothing by itself: the import command does that.
ALTER TABLE "products" ADD COLUMN "odoo_id" INTEGER;
ALTER TABLE "products" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "products_odoo_id_key" ON "products"("odoo_id");

ALTER TABLE "categories" ADD COLUMN "odoo_id" INTEGER;
CREATE UNIQUE INDEX "categories_odoo_id_key" ON "categories"("odoo_id");
```

- [ ] **Step 3: Start the databases, apply, regenerate**

Run (from the repo root, Docker Desktop must be running): `docker compose up -d db db-test`
Then from `api/`: `npm run db:migrate && npm run prisma:generate && npm run typecheck`
Expected: migration `20261007100000_odoo_catalogue` applied; typecheck passes.

- [ ] **Step 4: Confirm the schema and migration agree**

Run: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code`
Expected: "No difference detected" (exit code 0). If this Prisma version needs a shadow database flag, use `npx prisma migrate status` and expect "Database schema is up to date!".

- [ ] **Step 5: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/20261007100000_odoo_catalogue
git commit -m "feat(db): product hidden switch and Odoo ids"
```

---

### Task 2: The hidden switch in the API

**Files:**
- Modify: `api/src/products/dto/products.dto.ts` (`ListProductsQueryDto`)
- Modify: `api/src/products/product.view.ts`
- Modify: `api/src/products/products.service.ts` (`list`, `reorder`)
- Modify: `api/src/showroom/showroom.service.ts` (`products`, order placement)
- Modify: `api/src/public/public-catalog.service.ts` (`list`, `categories`)
- Test: `api/test/hidden-products.e2e-spec.ts` (new)

**Interfaces:**
- Consumes: `Product.isActive` from Task 1.
- Produces: `GET /api/products?visibility=active|hidden|all` (default `active`); `isActive` on the staff product view.

- [ ] **Step 1: Write the failing e2e test**

`api/test/hidden-products.e2e-spec.ts`:

```ts
import { createTestApp, type TestApp } from './utils/app';
import { bearer, login, showroomLogin } from './utils/auth';
import { PW, seedWorld, type World } from './utils/fixtures';

describe('Hidden products (e2e)', () => {
  let t: TestApp;
  let world: World;
  let admin: string;
  let manager: string;
  let hiddenId: string;

  beforeAll(async () => {
    t = await createTestApp();
    world = await seedWorld(t.prisma);
    admin = (await login(t, 'admin', PW.admin)).token;
    manager = (await login(t, 'gh.manager', PW.manager)).token;
    // Dash Cam is priced, so only the switch can keep it out of the showroom
    hiddenId = world.products[0].id;
    await t.prisma.product.update({ where: { id: hiddenId }, data: { isActive: false } });
  });
  afterAll(async () => {
    await t.close();
  });

  const ids = (body: { id: string }[]) => body.map((p) => p.id);

  it('is absent from the public catalogue', async () => {
    const res = await t.http().get('/api/public/products');
    expect(res.status).toBe(200);
    expect(ids(res.body)).not.toContain(hiddenId);
    expect(res.body).toHaveLength(2);
  });

  it('is absent from the showroom and cannot be ordered', async () => {
    const kiosk = await showroomLogin(t, 'gh.cashier', PW.showroom);
    const list = await t.http().get('/api/showroom/products').set(bearer(kiosk.token));
    expect(list.status).toBe(200);
    expect(ids(list.body.products)).toEqual([world.products[1].id]);

    const order = await t
      .http()
      .post('/api/showroom/orders')
      .set(bearer(kiosk.token))
      .send({ items: [{ productId: hiddenId, quantity: 1 }], customerName: 'Sara', userId: (kiosk.body.user as { id: string }).id });
    expect(order.status).toBe(400);
    expect(order.body.code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('is left out of the dashboard list unless asked for', async () => {
    const def = await t.http().get('/api/products').set(bearer(admin));
    expect(ids(def.body)).not.toContain(hiddenId);
    expect(def.body.every((p: { isActive: boolean }) => p.isActive)).toBe(true);

    const hidden = await t.http().get('/api/products?visibility=hidden').set(bearer(admin));
    expect(ids(hidden.body)).toEqual([hiddenId]);
    expect(hidden.body[0].isActive).toBe(false);

    const all = await t.http().get('/api/products?visibility=all').set(bearer(admin));
    expect(all.body).toHaveLength(3);

    expect((await t.http().get('/api/products?visibility=nope').set(bearer(admin))).status).toBe(400);
  });

  it('can still be opened by id', async () => {
    const res = await t.http().get(`/api/products/${hiddenId}`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('does not block a reorder, and keeps its place after the active products', async () => {
    const [, b, c] = world.products.map((p) => p.id);
    const res = await t.http().put('/api/products/order').set(bearer(manager)).send({ productIds: [c, b] });
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([c, b]);

    const rows = await t.prisma.branchProduct.findMany({ where: { branchId: world.gh.id }, orderBy: { position: 'asc' } });
    expect(rows.map((r) => r.productId)).toEqual([c, b, hiddenId]);

    // a hidden id in the list is as wrong as an unknown one
    const withHidden = await t.http().put('/api/products/order').set(bearer(manager)).send({ productIds: [c, b, hiddenId] });
    expect(withHidden.status).toBe(400);
    expect(withHidden.body.code).toBe('ORDER_MISMATCH');
  });
});
```

If `GET /api/showroom/products` is not the showroom list route, read `api/src/showroom/showroom.controller.ts` and use the route that calls `ShowroomService.products`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:e2e -- hidden-products`
Expected: FAIL (the hidden product is still listed; `visibility` is rejected or ignored).

- [ ] **Step 3: DTO — add the `visibility` filter**

In `api/src/products/dto/products.dto.ts`, inside `ListProductsQueryDto` after the `price` field:

```ts
  /** Hidden products are kept for past orders; the list leaves them out unless asked. */
  @IsOptional()
  @IsIn(['active', 'hidden', 'all'])
  visibility: 'active' | 'hidden' | 'all' = 'active';
```

- [ ] **Step 4: View — expose `isActive`**

In `api/src/products/product.view.ts`: add `isActive: true,` to `PRODUCT_SELECT` after `barcode`, add `isActive: boolean;` to `ProductRow` after `barcode`, and add `isActive: p.isActive,` to the object returned by `productView` after `barcode`.

- [ ] **Step 5: Service — filter the list**

In `ProductsService.list`, replace the `where` declaration with:

```ts
    const where: Prisma.ProductWhereInput = {
      ...(q.visibility === 'all' ? {} : { isActive: q.visibility !== 'hidden' }),
      ...(q.price === 'priced' ? { price: { not: null } } : q.price === 'unpriced' ? { price: null } : {}),
      ...(q.q
        ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { barcode: { contains: q.q, mode: 'insensitive' } }] }
        : {}),
    };
```

- [ ] **Step 6: Service — reorder only the active products**

In `ProductsService.reorder`, replace the block from `const current = await tx.branchProduct.findMany(` through the `$executeRaw` UPDATE with:

```ts
      const current = await tx.branchProduct.findMany({
        where: { branchId },
        orderBy: { position: 'asc' },
        select: { productId: true, product: { select: { isActive: true } } },
      });
      // the dashboard only shows (and so only sends) the active products;
      // hidden ones keep a place after them so nothing is lost if they return
      const currentIds = current.filter((r) => r.product.isActive).map((r) => r.productId);
      const hiddenIds = current.filter((r) => !r.product.isActive).map((r) => r.productId);
      const known = new Set(currentIds);
      const missing = currentIds.filter((pid) => !dto.productIds.includes(pid)).length;
      const unknown = dto.productIds.filter((pid) => !known.has(pid)).length;
      if (missing || unknown) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'ORDER_MISMATCH',
          message: 'The list must contain every product of the branch exactly once. Refresh and try again.',
          missing,
          unknown,
        });
      }
      const ordered = [...dto.productIds, ...hiddenIds];
      await tx.$executeRaw`
        UPDATE branch_products bp
           SET position = o.ord - 1
          FROM unnest(${ordered}::uuid[]) WITH ORDINALITY AS o(product_id, ord)
         WHERE bp.branch_id = ${branchId}::uuid AND bp.product_id = o.product_id`;
      return currentIds;
```

The method's last line stays `return this.list({ ...user, branchId }, { price: 'all' });` but must now pass the new field: change it to `{ price: 'all', visibility: 'active' }`.

- [ ] **Step 7: Showroom**

In `api/src/showroom/showroom.service.ts`:
- in `products`, change `product: { price: { not: null } }` to `product: { price: { not: null }, isActive: true }`;
- in the order transaction's `tx.product.findMany`, add `isActive: true,` to `where` after `price: { not: null },`.

- [ ] **Step 8: Public catalogue**

In `api/src/public/public-catalog.service.ts`:
- `list`: replace the `where` line with
  `where: { isActive: true, ...(categoryId ? { categoryId, category: { isActive: true } } : {}) },`
- `categories`: change `products: { some: {} }` to `products: { some: { isActive: true } }`, and `_count: { select: { products: true } }` to `_count: { select: { products: { where: { isActive: true } } } }`.

- [ ] **Step 9: Run the tests**

Run: `npm run test:e2e -- hidden-products` → PASS.
Run: `npm test && npm run test:e2e && npm run lint && npm run typecheck`
Expected: all pass. If an existing e2e test compares the exact keys of a staff product, add `isActive` to its expected keys; that is the only acceptable edit to existing tests.

- [ ] **Step 10: Commit**

```bash
git add api/src/products api/src/showroom api/src/public api/test
git commit -m "feat(api): hidden products stay out of the showroom, website and dashboard list"
```

---

### Task 3: Odoo row mapping (pure functions)

**Files:**
- Create: `api/src/odoo/odoo-rows.ts`
- Test: `api/src/odoo/odoo-rows.spec.ts`

**Interfaces:**
- Consumes: `normaliseText` from `api/src/legacy-import/legacy-rows.ts`; `BARCODE_PATTERN`, `PRICE_PATTERN`, `PRODUCT_NAME_MAX` from `shared/validation.ts`.
- Produces:
  - `interface OdooVariant { id: number; display_name: string; barcode: string | false; lst_price: number; active: boolean; sale_ok: boolean; type: string; categ_id: [number, string] | false }`
  - `interface OdooProduct { odooId: number; name: string; barcode: string | null; price: string; categoryOdooId: number | null; categoryPath: string | null; warnings: string[] }`
  - `const VARIANT_FIELDS: readonly string[]`
  - `skipReason(v: OdooVariant): string | null`
  - `toProduct(v: OdooVariant): OdooProduct`
  - `categoryName(path: string): string`

- [ ] **Step 1: Write the failing tests**

`api/src/odoo/odoo-rows.spec.ts`:

```ts
import { categoryName, skipReason, toProduct, type OdooVariant } from './odoo-rows';

const variant = (over: Partial<OdooVariant> = {}): OdooVariant => ({
  id: 2729,
  display_name: 'ARM REST COVER (Black)',
  barcode: '10011100161',
  lst_price: 99,
  active: true,
  sale_ok: true,
  type: 'consu',
  categ_id: [29, 'Car / CAR ACCESSORIES'],
  ...over,
});

describe('skipReason', () => {
  it('accepts a sellable, priced good', () => {
    expect(skipReason(variant())).toBeNull();
  });

  it.each([
    [0, 'price is 0 or 1'],
    [1, 'price is 0 or 1'],
    [-5, 'price is 0 or 1'],
    [Number.NaN, 'price is 0 or 1'],
  ])('rejects the placeholder price %p', (lst_price, reason) => {
    expect(skipReason(variant({ lst_price }))).toBe(reason);
  });

  it('accepts a price just above 1', () => {
    expect(skipReason(variant({ lst_price: 1.01 }))).toBeNull();
  });

  it('rejects a price too large for the price column', () => {
    expect(skipReason(variant({ lst_price: 99_999_999_999 }))).toBe('price out of range');
  });

  it('rejects services, archived and not-for-sale products', () => {
    expect(skipReason(variant({ type: 'service' }))).toBe('service');
    expect(skipReason(variant({ active: false }))).toBe('archived');
    expect(skipReason(variant({ sale_ok: false }))).toBe('not for sale');
  });

  it('rejects anything under an Expenses category, however it is spaced or cased', () => {
    expect(skipReason(variant({ categ_id: [5, 'Expenses'] }))).toBe('expenses category');
    expect(skipReason(variant({ categ_id: [6, 'All/expenses / Fuel'] }))).toBe('expenses category');
  });

  it('rejects a product whose name is too short to show', () => {
    expect(skipReason(variant({ display_name: ' x ' }))).toBe('no usable name');
  });
});

describe('toProduct', () => {
  it('maps a clean variant', () => {
    expect(toProduct(variant())).toEqual({
      odooId: 2729,
      name: 'ARM REST COVER (Black)',
      barcode: '10011100161',
      price: '99.00',
      categoryOdooId: 29,
      categoryPath: 'Car / CAR ACCESSORIES',
      warnings: [],
    });
  });

  it('normalises Arabic presentation forms and whitespace in the name', () => {
    expect(toProduct(variant({ display_name: '  ﻟﻴﻮﺑﺎرد   5 ' })).name).toBe('ليوبارد 5');
  });

  it('truncates an over-long name and says so', () => {
    const p = toProduct(variant({ display_name: 'x'.repeat(200) }));
    expect(p.name).toHaveLength(120);
    expect(p.warnings).toEqual(['name truncated to 120 characters']);
  });

  it('drops a barcode the app cannot store, keeping the product', () => {
    const p = toProduct(variant({ barcode: '1001 110/056' }));
    expect(p.barcode).toBeNull();
    expect(p.warnings).toEqual(['dropped unusable barcode "1001 110/056"']);
  });

  it('treats a missing barcode and a missing category as empty', () => {
    const p = toProduct(variant({ barcode: false, categ_id: false }));
    expect(p).toMatchObject({ barcode: null, categoryOdooId: null, categoryPath: null, warnings: [] });
  });

  it('rounds the price to two decimals', () => {
    expect(toProduct(variant({ lst_price: 49.999 })).price).toBe('50.00');
  });
});

describe('categoryName', () => {
  it('keeps the last part of the Odoo path', () => {
    expect(categoryName('Car / LEOPARD / LEOPARD 5')).toBe('LEOPARD 5');
    expect(categoryName('Car/XIAOMI/YU7')).toBe('YU7');
    expect(categoryName('THABT')).toBe('THABT');
  });

  it('ignores a trailing separator', () => {
    expect(categoryName('Car / ROX / ')).toBe('ROX');
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm test -- odoo-rows`
Expected: FAIL, "Cannot find module './odoo-rows'".

- [ ] **Step 3: Implement**

`api/src/odoo/odoo-rows.ts`:

```ts
/**
 * Decides which Odoo product variants belong in this catalogue and maps them
 * onto the shape this database wants. Pure functions only — the import script
 * does the I/O.
 */
import { BARCODE_PATTERN, PRICE_PATTERN, PRODUCT_NAME_MAX } from '../../../shared/validation';
import { normaliseText } from '../legacy-import/legacy-rows';

/** A product.product row as read with VARIANT_FIELDS. Odoo sends `false` for an empty field. */
export interface OdooVariant {
  id: number;
  display_name: string;
  barcode: string | false;
  lst_price: number;
  active: boolean;
  sale_ok: boolean;
  type: string;
  categ_id: [number, string] | false;
}

export const VARIANT_FIELDS = ['display_name', 'barcode', 'lst_price', 'active', 'sale_ok', 'type', 'categ_id'] as const;

export interface OdooProduct {
  odooId: number;
  name: string;
  barcode: string | null;
  /** QAR with two decimals, e.g. "99.00" */
  price: string;
  categoryOdooId: number | null;
  /** Odoo's full category path, e.g. "Car / LEOPARD / LEOPARD 5" */
  categoryPath: string | null;
  /** Anything the import had to change or drop, reported at the end of the run. */
  warnings: string[];
}

const pathParts = (path: string): string[] =>
  path
    .split('/')
    .map((part) => normaliseText(part))
    .filter(Boolean);

/** Why a variant is left out of the catalogue, or null when it belongs in it. */
export function skipReason(v: OdooVariant): string | null {
  if (!v.active) return 'archived';
  if (!v.sale_ok) return 'not for sale';
  if (v.type === 'service') return 'service';
  if (v.categ_id && pathParts(v.categ_id[1]).some((part) => part.toLowerCase() === 'expenses')) return 'expenses category';
  // 0 and 1 are placeholders in Odoo, not prices
  if (!Number.isFinite(v.lst_price) || v.lst_price <= 1) return 'price is 0 or 1';
  if (!PRICE_PATTERN.test(v.lst_price.toFixed(2))) return 'price out of range';
  if (normaliseText(v.display_name).length < 2) return 'no usable name';
  return null;
}

/** Maps a variant that passed skipReason. */
export function toProduct(v: OdooVariant): OdooProduct {
  const warnings: string[] = [];

  let name = normaliseText(v.display_name);
  if (name.length > PRODUCT_NAME_MAX) {
    warnings.push(`name truncated to ${PRODUCT_NAME_MAX} characters`);
    name = name.slice(0, PRODUCT_NAME_MAX);
  }

  let barcode: string | null = (v.barcode ? normaliseText(v.barcode) : '') || null;
  if (barcode && !BARCODE_PATTERN.test(barcode)) {
    warnings.push(`dropped unusable barcode ${JSON.stringify(barcode)}`);
    barcode = null;
  }

  return {
    odooId: v.id,
    name,
    barcode,
    price: v.lst_price.toFixed(2),
    categoryOdooId: v.categ_id ? v.categ_id[0] : null,
    categoryPath: v.categ_id ? v.categ_id[1] : null,
    warnings,
  };
}

/** "Car / LEOPARD / LEOPARD 5" → "LEOPARD 5": the last part is the car model. */
export function categoryName(path: string): string {
  const parts = pathParts(path);
  return (parts.at(-1) ?? normaliseText(path)).slice(0, 120);
}
```

Before running, open `shared/validation.ts` and check `PRICE_PATTERN` and `PRODUCT_NAME_MAX`: if `PRODUCT_NAME_MAX` is not 120, change the two `120` literals in the spec file's truncation test to match; if `PRICE_PATTERN` accepts `99999999999.00`, raise the test's out-of-range number until it is rejected.

- [ ] **Step 4: Run the tests**

Run: `npm test -- odoo-rows`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/odoo/odoo-rows.ts api/src/odoo/odoo-rows.spec.ts
git commit -m "feat(odoo): choose and map Odoo variants for the catalogue"
```

---

### Task 4: Odoo client

**Files:**
- Create: `api/src/odoo/odoo-client.ts`
- Test: `api/src/odoo/odoo-client.spec.ts`

**Interfaces:**
- Produces:
  - `interface OdooConfig { url: string; db: string; login: string; apiKey: string }`
  - `odooConfigFromEnv(env: Record<string, string | undefined>): OdooConfig` — throws naming every missing variable
  - `class OdooClient { constructor(cfg: OdooConfig, fetchFn?: typeof fetch); searchRead<T>(model: string, domain: unknown[], fields: readonly string[], context?: Record<string, unknown>): Promise<T[]>; read<T>(model: string, ids: number[], fields: readonly string[]): Promise<T[]> }`
  - `class OdooError extends Error`

- [ ] **Step 1: Write the failing tests**

`api/src/odoo/odoo-client.spec.ts`:

```ts
import { OdooClient, OdooError, odooConfigFromEnv } from './odoo-client';

const cfg = { url: 'https://odoo.test/', db: 'db1', login: 'bot@x.qa', apiKey: 'secret-key' };

/** A fetch stand-in that answers each call from a queue and records the requests. */
function fakeFetch(...answers: (unknown | Response)[]) {
  const calls: { url: string; body: any }[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const next = answers.shift();
    if (next instanceof Response) return next;
    return new Response(JSON.stringify(next), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fn, calls };
}

describe('odooConfigFromEnv', () => {
  it('reads the four variables and trims the URL', () => {
    expect(odooConfigFromEnv({ ODOO_URL: ' https://o.test/ ', ODOO_DB: 'd', ODOO_LOGIN: 'l', ODOO_API_KEY: 'k' })).toEqual({
      url: 'https://o.test',
      db: 'd',
      login: 'l',
      apiKey: 'k',
    });
  });

  it('names every missing variable', () => {
    expect(() => odooConfigFromEnv({ ODOO_URL: 'https://o.test', ODOO_DB: '' })).toThrow('ODOO_DB, ODOO_LOGIN, ODOO_API_KEY');
  });
});

describe('OdooClient', () => {
  it('authenticates once, then calls search_read with the uid and key', async () => {
    const { fn, calls } = fakeFetch({ result: 7 }, { result: [{ id: 1 }] }, { result: [{ id: 2 }] });
    const client = new OdooClient(cfg, fn);

    expect(await client.searchRead('product.product', [['sale_ok', '=', true]], ['display_name'], { lang: 'ar_001' })).toEqual([{ id: 1 }]);
    expect(await client.read('product.product', [2], ['image_1920'])).toEqual([{ id: 2 }]);

    expect(calls).toHaveLength(3);
    expect(calls[0].url).toBe('https://odoo.test/jsonrpc');
    expect(calls[0].body.params).toEqual({ service: 'common', method: 'authenticate', args: ['db1', 'bot@x.qa', 'secret-key', {}] });
    expect(calls[1].body.params).toEqual({
      service: 'object',
      method: 'execute_kw',
      args: ['db1', 7, 'secret-key', 'product.product', 'search_read', [[['sale_ok', '=', true]]], { fields: ['display_name'], context: { lang: 'ar_001' } }],
    });
    expect(calls[2].body.params.args.slice(3)).toEqual(['product.product', 'read', [[2]], { fields: ['image_1920'] }]);
  });

  it('stops with a clear message when Odoo rejects the login', async () => {
    const { fn } = fakeFetch({ result: false });
    await expect(new OdooClient(cfg, fn).searchRead('product.product', [], ['id'])).rejects.toThrow('Odoo rejected the login');
  });

  it('reports the Odoo error message, never the API key', async () => {
    const { fn } = fakeFetch({ result: 7 }, { error: { message: 'Odoo Server Error', data: { message: 'Access Denied for secret-key' } } });
    const err = await new OdooClient(cfg, fn).searchRead('product.product', [], ['id']).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OdooError);
    expect((err as Error).message).toContain('Access Denied');
    expect((err as Error).message).not.toContain('secret-key');
  });

  it('explains a non-JSON answer such as a proxy error page', async () => {
    const { fn } = fakeFetch(new Response('<html><h1>502 Bad Gateway</h1></html>', { status: 502 }));
    await expect(new OdooClient(cfg, fn).searchRead('product.product', [], ['id'])).rejects.toThrow(
      'Odoo answered HTTP 502 with something that is not JSON',
    );
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm test -- odoo-client`
Expected: FAIL, "Cannot find module './odoo-client'".

- [ ] **Step 3: Implement**

`api/src/odoo/odoo-client.ts`:

```ts
/**
 * Minimal read-only client for Odoo's JSON-RPC endpoint. The only file that
 * knows Odoo's wire format; everything else works with plain rows.
 */
export interface OdooConfig {
  /** Base address without a trailing slash, e.g. https://erp-test.wolf-groups.com */
  url: string;
  db: string;
  login: string;
  apiKey: string;
}

export class OdooError extends Error {}

const ENV_KEYS = ['ODOO_URL', 'ODOO_DB', 'ODOO_LOGIN', 'ODOO_API_KEY'] as const;

export function odooConfigFromEnv(env: Record<string, string | undefined>): OdooConfig {
  const value = (key: (typeof ENV_KEYS)[number]) => (env[key] ?? '').trim();
  const missing = ENV_KEYS.filter((key) => !value(key));
  if (missing.length) throw new OdooError(`Missing Odoo settings in api/.env: ${missing.join(', ')}`);
  return {
    url: value('ODOO_URL').replace(/\/+$/, ''),
    db: value('ODOO_DB'),
    login: value('ODOO_LOGIN'),
    apiKey: value('ODOO_API_KEY'),
  };
}

interface RpcReply<T> {
  result?: T;
  error?: { message?: string; data?: { message?: string } };
}

export class OdooClient {
  private uid: number | undefined;

  constructor(
    private readonly cfg: OdooConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  searchRead<T>(model: string, domain: unknown[], fields: readonly string[], context?: Record<string, unknown>): Promise<T[]> {
    return this.execute<T[]>(model, 'search_read', [domain], { fields: [...fields], ...(context ? { context } : {}) });
  }

  read<T>(model: string, ids: number[], fields: readonly string[]): Promise<T[]> {
    return this.execute<T[]>(model, 'read', [ids], { fields: [...fields] });
  }

  private async execute<T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown>): Promise<T> {
    if (this.uid === undefined) {
      const uid = await this.rpc<number | false>('common', 'authenticate', [this.cfg.db, this.cfg.login, this.cfg.apiKey, {}]);
      if (!uid) throw new OdooError('Odoo rejected the login. Check ODOO_DB, ODOO_LOGIN and ODOO_API_KEY.');
      this.uid = uid;
    }
    return this.rpc<T>('object', 'execute_kw', [this.cfg.db, this.uid, this.cfg.apiKey, model, method, args, kwargs]);
  }

  private async rpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
    const res = await this.fetchFn(`${this.cfg.url}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args } }),
      signal: AbortSignal.timeout(120_000),
    });
    let reply: RpcReply<T>;
    try {
      reply = (await res.json()) as RpcReply<T>;
    } catch {
      throw new OdooError(`Odoo answered HTTP ${res.status} with something that is not JSON. Check ODOO_URL.`);
    }
    if (reply.error) {
      const message = reply.error.data?.message ?? reply.error.message ?? 'unknown error';
      // Odoo sometimes echoes arguments back; the key must never reach a log
      throw new OdooError(`Odoo error: ${message.split(this.cfg.apiKey).join('***').slice(0, 500)}`);
    }
    return reply.result as T;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- odoo-client && npm run lint && npm run typecheck`
Expected: PASS. If oxlint rejects `any` in the spec's `fakeFetch`, type `body` as `{ params: { service: string; method: string; args: unknown[] } }`.

- [ ] **Step 5: Commit**

```bash
git add api/src/odoo/odoo-client.ts api/src/odoo/odoo-client.spec.ts
git commit -m "feat(odoo): read-only JSON-RPC client"
```

---

### Task 5: The import command

**Files:**
- Create: `api/src/odoo/placeholder-image.ts`
- Create: `api/src/odoo/place-in-branch.ts`
- Create: `api/prisma/import-odoo.ts`
- Modify: `api/prisma/import-legacy.ts` (use the shared `placeInBranch`, delete its private copy)
- Modify: `api/package.json` (script), `api/.env.example`

**Interfaces:**
- Consumes: `OdooClient`, `odooConfigFromEnv` (Task 4); `VARIANT_FIELDS`, `skipReason`, `toProduct`, `categoryName`, `OdooVariant`, `OdooProduct` (Task 3); `processAndStoreImage`, `deleteStoredImage` from `api/src/uploads/image-processing.ts`.
- Produces: `npm run db:import-odoo -- [--dry-run] [--hide-legacy] [--force-images]`; `placeInBranch(prisma: PrismaClient, branchId: string, productIds: string[]): Promise<number>`; `placeholderImage(): Promise<Buffer>`.

- [ ] **Step 1: Share `placeInBranch`**

Create `api/src/odoo/place-in-branch.ts` by moving the function out of `api/prisma/import-legacy.ts` unchanged, exported, with its doc comment:

```ts
import type { PrismaClient } from '../generated/prisma/client';

/**
 * Appends every imported product to the branch's showroom order, keeping the
 * positions already chosen by the branch manager. Runs in one transaction so
 * the deferred unique (branch_id, position) constraint is checked at commit.
 */
export async function placeInBranch(prisma: PrismaClient, branchId: string, productIds: string[]): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.branchProduct.findMany({
      where: { branchId },
      select: { productId: true, position: true },
    });
    const known = new Set(existing.map((e) => e.productId));
    let next = existing.reduce((max, e) => Math.max(max, e.position), -1) + 1;

    const rows = productIds
      .filter((id) => !known.has(id))
      .map((productId) => ({ branchId, productId, position: next++ }));
    if (rows.length) await tx.branchProduct.createMany({ data: rows });
    return rows.length;
  });
}
```

In `api/prisma/import-legacy.ts` delete the local `placeInBranch` function and add `import { placeInBranch } from '../src/odoo/place-in-branch';`.

- [ ] **Step 2: Placeholder image**

`api/src/odoo/placeholder-image.ts`:

```ts
import sharp from 'sharp';

/** A neutral card for products Odoo has no photo of. */
export async function placeholderImage(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
    <rect width="1200" height="1200" fill="#f5f4f1"/>
    <rect x="390" y="430" width="420" height="300" rx="28" fill="none" stroke="#c9c4ba" stroke-width="22"/>
    <circle cx="505" cy="535" r="38" fill="#c9c4ba"/>
    <path d="M410 700 L560 580 L650 650 L720 600 L790 700 Z" fill="#c9c4ba"/>
    <text x="600" y="1110" font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700"
      letter-spacing="10" fill="#9c968c" text-anchor="middle">WOLF CAR</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
```

- [ ] **Step 3: The command**

`api/prisma/import-odoo.ts`:

```ts
/**
 * Fills the catalogue from the company's Odoo.
 *
 *   npm run db:import-odoo -- [--dry-run] [--hide-legacy] [--force-images]
 *
 * Read-only towards Odoo, and it never deletes anything here. Products are
 * keyed on the Odoo variant id, so re-running updates rows instead of
 * duplicating them. A product that Odoo no longer offers (archived, or
 * repriced to 0 or 1) is switched off, not removed.
 *
 *   --dry-run       show what would happen, write nothing
 *   --hide-legacy   switch off every product that did not come from Odoo
 *   --force-images  fetch every image again, not only for new products
 */
import path from 'node:path';
import { PrismaClient } from '../src/generated/prisma/client';
import { OdooClient, odooConfigFromEnv } from '../src/odoo/odoo-client';
import { categoryName, skipReason, toProduct, VARIANT_FIELDS, type OdooProduct, type OdooVariant } from '../src/odoo/odoo-rows';
import { placeInBranch } from '../src/odoo/place-in-branch';
import { placeholderImage } from '../src/odoo/placeholder-image';
import { createPgAdapter } from '../src/prisma/pg-adapter';
import { deleteStoredImage, processAndStoreImage } from '../src/uploads/image-processing';

try {
  process.loadEnvFile('.env');
} catch {
  /* env comes from the process */
}

const IMPORT_USERNAME = 'system.odoo';
const IMAGE_BATCH = 25;
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const dryRun = hasFlag('dry-run');
  const hideLegacy = hasFlag('hide-legacy');
  const forceImages = hasFlag('force-images');
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './storage/uploads');

  const config = odooConfigFromEnv(process.env);
  const odoo = new OdooClient(config);
  console.log(`Reading products from ${config.url} (database ${config.db})`);

  // ---- read everything from Odoo before touching the database --------------
  // archived variants are left out by Odoo itself; ar_001 gives the Arabic name
  // where one exists, and display_default_code drops the "[PROD-001]" prefix
  const variants = await odoo.searchRead<OdooVariant>('product.product', [], VARIANT_FIELDS, {
    lang: 'ar_001',
    display_default_code: false,
  });
  const skipped = new Map<string, number>();
  const products: OdooProduct[] = [];
  for (const v of variants) {
    const reason = skipReason(v);
    if (reason) skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
    else products.push(toProduct(v));
  }
  console.log(`Odoo has ${variants.length} variants: ${products.length} to import, ${variants.length - products.length} left out`);
  for (const [reason, n] of [...skipped].sort((a, b) => b[1] - a[1])) console.log(`  - ${n} ${reason}`);

  const prisma = new PrismaClient({ adapter: createPgAdapter(url) });
  const warnings: string[] = [];
  try {
    const existing = new Map(
      (await prisma.product.findMany({ where: { odooId: { not: null } }, select: { id: true, odooId: true, imageKey: true, price: true } })).map(
        (p) => [p.odooId as number, p],
      ),
    );
    const wanted = new Set(products.map((p) => p.odooId));
    const stale = [...existing.values()].filter((p) => !wanted.has(p.odooId as number));
    const legacyCount = await prisma.product.count({ where: { odooId: null, isActive: true } });

    if (dryRun) {
      console.log('\nDry run — nothing was written.');
      console.log(`  would create ${products.filter((p) => !existing.has(p.odooId)).length} products`);
      console.log(`  would update ${products.filter((p) => existing.has(p.odooId)).length} products`);
      console.log(`  would switch off ${stale.length} products Odoo no longer offers`);
      if (hideLegacy) console.log(`  would hide ${legacyCount} products that did not come from Odoo`);
      for (const p of products.slice(0, 10)) console.log(`  e.g. ${p.price.padStart(10)}  ${p.barcode ?? '-'}  ${p.name}`);
      return;
    }

    // ---- images (files only; still no database writes) ---------------------
    const needImage = products.filter((p) => forceImages || !existing.has(p.odooId)).map((p) => p.odooId);
    const imageKeys = new Map<number, string>();
    const placeholder = await placeholderImage();
    let withPhoto = 0;
    for (let i = 0; i < needImage.length; i += IMAGE_BATCH) {
      const ids = needImage.slice(i, i + IMAGE_BATCH);
      const rows = await odoo.read<{ id: number; image_1920: string | false }>('product.product', ids, ['image_1920']);
      const byId = new Map(rows.map((r) => [r.id, r.image_1920]));
      for (const id of ids) {
        const b64 = byId.get(id);
        let key: string | undefined;
        if (b64) {
          try {
            key = await processAndStoreImage(Buffer.from(b64, 'base64'), uploadDir);
            withPhoto++;
          } catch (err) {
            warnings.push(`odoo ${id}: image could not be processed (${(err as Error).message}); placeholder used`);
          }
        }
        imageKeys.set(id, key ?? (await processAndStoreImage(placeholder, uploadDir)));
      }
      console.log(`  images …${Math.min(i + IMAGE_BATCH, needImage.length)}/${needImage.length}`);
    }
    console.log(`Images: ${withPhoto} from Odoo, ${needImage.length - withPhoto} placeholders`);

    // ---- database ----------------------------------------------------------
    // the catalogue has to belong to someone: Product.createdById is required
    const importer = await prisma.user.upsert({
      where: { username: IMPORT_USERNAME },
      update: {},
      create: {
        username: IMPORT_USERNAME,
        displayName: 'Odoo catalogue import',
        role: 'SUPER_ADMIN',
        // no usable password hash: this account exists for attribution only
        passwordHash: 'x'.repeat(97),
        isActive: false,
      },
      select: { id: true },
    });

    // categories: created once, then left alone so a name or image set in the dashboard survives
    const categoryIdByOdoo = new Map<number, string>();
    const paths = new Map<number, string>();
    for (const p of products) if (p.categoryOdooId !== null && p.categoryPath) paths.set(p.categoryOdooId, p.categoryPath);
    let position = ((await prisma.category.aggregate({ _max: { position: true } }))._max.position ?? -1) + 1;
    for (const [odooId, categoryPath] of [...paths].sort((a, b) => a[1].localeCompare(b[1]))) {
      const found = await prisma.category.findUnique({ where: { odooId }, select: { id: true } });
      const name = categoryName(categoryPath);
      const saved =
        found ??
        (await prisma.category.create({
          data: { odooId, name, nameEn: /[؀-ۿ]/.test(name) ? null : name, carModel: name, position: position++ },
          select: { id: true },
        }));
      categoryIdByOdoo.set(odooId, saved.id);
    }
    console.log(`Categories: ${categoryIdByOdoo.size}`);

    let created = 0;
    let updated = 0;
    let repriced = 0;
    const createdIds: string[] = [];
    const replacedImages: string[] = [];
    for (const [i, p] of products.entries()) {
      for (const w of p.warnings) warnings.push(`odoo ${p.odooId} (${p.name}): ${w}`);
      const categoryId = p.categoryOdooId === null ? null : (categoryIdByOdoo.get(p.categoryOdooId) ?? null);
      const before = existing.get(p.odooId);
      const newKey = imageKeys.get(p.odooId);

      if (!before) {
        const row = await prisma.product.create({
          data: {
            odooId: p.odooId,
            name: p.name,
            barcode: p.barcode,
            categoryId,
            imageKey: newKey as string,
            price: p.price,
            priceUpdatedAt: new Date(),
            createdById: importer.id,
            priceHistory: { create: { oldPrice: null, newPrice: p.price, changedById: importer.id } },
          },
          select: { id: true },
        });
        createdIds.push(row.id);
        created++;
      } else {
        const priceChanged = before.price === null || before.price.toFixed(2) !== p.price;
        await prisma.product.update({
          where: { id: before.id },
          data: {
            name: p.name,
            barcode: p.barcode,
            categoryId,
            isActive: true,
            updatedById: importer.id,
            ...(newKey ? { imageKey: newKey } : {}),
            ...(priceChanged
              ? {
                  price: p.price,
                  priceUpdatedAt: new Date(),
                  priceHistory: { create: { oldPrice: before.price, newPrice: p.price, changedById: importer.id } },
                }
              : {}),
          },
        });
        if (newKey) replacedImages.push(before.imageKey);
        if (priceChanged) repriced++;
        updated++;
      }
      if ((i + 1) % 200 === 0) console.log(`  …${i + 1}/${products.length}`);
    }
    for (const key of replacedImages) await deleteStoredImage(key, uploadDir);
    console.log(`Products: ${created} created, ${updated} updated (${repriced} repriced)`);

    if (stale.length) {
      await prisma.product.updateMany({ where: { id: { in: stale.map((p) => p.id) } }, data: { isActive: false } });
    }
    console.log(`Switched off ${stale.length} products Odoo no longer offers`);

    if (hideLegacy) {
      const hidden = await prisma.product.updateMany({ where: { odooId: null, isActive: true }, data: { isActive: false } });
      const emptied = await prisma.category.updateMany({
        where: { isActive: true, products: { none: { isActive: true } } },
        data: { isActive: false },
      });
      console.log(`Hidden: ${hidden.count} legacy products, ${emptied.count} categories left without products`);
    }

    const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, code: true } });
    for (const branch of branches) {
      console.log(`Branch ${branch.code}: ${await placeInBranch(prisma, branch.id, createdIds)} products placed`);
    }

    console.log('\nDone.');
    if (warnings.length) {
      console.log(`\n${warnings.length} warning(s):`);
      for (const w of warnings.slice(0, 40)) console.log(`  - ${w}`);
      if (warnings.length > 40) console.log(`  …and ${warnings.length - 40} more`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
```

- [ ] **Step 4: Script and env example**

In `api/package.json` scripts, after `db:import-legacy` add:

```json
    "db:import-odoo": "tsx prisma/import-odoo.ts",
```

Append to `api/.env.example`:

```
# ---- odoo ------------------------------------------------------------------
# Read by `npm run db:import-odoo` only; the API server does not use them.
# Create the key in Odoo as a dedicated user: My Profile → Account Security → New API Key.
ODOO_URL=
ODOO_DB=
ODOO_LOGIN=
ODOO_API_KEY=
```

- [ ] **Step 5: Check it builds**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 6: Dry run against the test Odoo**

Run: `npm run db:import-odoo -- --dry-run --hide-legacy`
Expected: prints the variant counts, the reasons for those left out (including a line `… price is 0 or 1`), "Dry run — nothing was written.", and ten sample lines. No `ODOO_API_KEY` value anywhere in the output.
Then confirm nothing was written: `psql "$DATABASE_URL" -c "select count(*) from products where odoo_id is not null"` → `0` (or run the same count through `npx prisma studio` if `psql` is missing).

- [ ] **Step 7: Commit**

```bash
git add api/prisma/import-odoo.ts api/prisma/import-legacy.ts api/src/odoo api/package.json api/.env.example
git commit -m "feat(odoo): db:import-odoo fills the catalogue from Odoo"
```

---

### Task 6: Local preview

**Files:** none changed. This task produces the running preview and its evidence.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Make sure the local database has the legacy catalogue**

Run: `psql "$DATABASE_URL" -c "select count(*) from products"`.
If it is 0, run `npm run db:seed && npm run db:import-legacy` first, so the "hidden, not deleted" behaviour is visible.

- [ ] **Step 2: Import for real, hiding the legacy products**

Run: `npm run db:import-odoo -- --hide-legacy`
Expected: "Products: N created, 0 updated", "Hidden: M legacy products, …", one "Branch …: N products placed" line per branch, "Done."

- [ ] **Step 3: Check the database against the rules**

```sql
select count(*) filter (where is_active and odoo_id is not null) as odoo_visible,
       count(*) filter (where not is_active and odoo_id is null)  as legacy_hidden,
       count(*) filter (where is_active and odoo_id is null)      as legacy_still_visible,
       count(*) filter (where odoo_id is not null and price <= 1) as placeholder_prices
from products;
```

Expected: `legacy_still_visible = 0`, `placeholder_prices = 0`, `odoo_visible` equals the "to import" number from the run, `legacy_hidden` equals the legacy row count.

- [ ] **Step 4: Run it a second time**

Run: `npm run db:import-odoo -- --hide-legacy`
Expected: "Products: 0 created, N updated (0 repriced)", no new images fetched ("Images: 0 from Odoo, 0 placeholders"). The product count in the database is unchanged.

- [ ] **Step 5: Spot-check five products against Odoo**

Pick five barcodes from the import output, and for each compare name and price between `select name, barcode, price from products where barcode = '…' and is_active` and the same barcode searched in the Odoo web interface (or `search_read` on `product.product`). All five must match.

- [ ] **Step 6: Start the app and look**

From `api/`: `npm run start:dev`. From the repo root, in a second terminal: `npm run dev`.
Open the dashboard products page and the showroom; confirm the Odoo products are listed with categories, prices and images or placeholders, and that no legacy product appears.

- [ ] **Step 7: Report**

Give the user: the counts from Step 3, the addresses to open, the logins from the seed, and how to undo (`update products set is_active = true where odoo_id is null; update categories set is_active = true where odoo_id is null;`).
