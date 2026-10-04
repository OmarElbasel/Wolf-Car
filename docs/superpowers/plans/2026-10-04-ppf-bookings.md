# PPF Bookings and General Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the call center (Amani) a PPF booking calendar and a private general-reservations list in the dashboard, and give salespeople a PIN-protected, read-only slots page where they can ask for a light job on a closed day.

**Architecture:** A new `RESERVATIONS` role with three `booking.*` permissions. Three new NestJS modules: `ppf` (bookings, closed days, light-job requests), `reservations` (general list) and `sales-access` (PIN, cookie, guard, `/api/slots`). Day state is computed in one pure function on the server and sent to both the dashboard page and the sales page. The web side adds two dashboard pages and one standalone page under `app/[locale]/(app)/slots`, all in `features/bookings/`.

**Tech Stack:** NestJS 12, Prisma 7 + PostgreSQL 17, class-validator, Jest + Supertest (API). Next.js 16, React 19, TanStack Query, react-hook-form + zod, next-intl, shadcn/ui, Vitest + Testing Library + MSW, Playwright (web).

**Spec:** `docs/superpowers/specs/2026-10-04-ppf-bookings-design.md` — read it before starting any task.

## Global Constraints

- **Next.js here is not the Next.js you know.** Before creating or editing anything under `app/`, read the relevant guide in `node_modules/next/dist/docs/01-app/` (`AGENTS.md`). New pages must mirror the existing ones (`app/[locale]/(app)/(staff)/dashboard/orders/page.tsx`, `app/[locale]/(app)/showroom/page.tsx`).
- **Never run `prisma migrate dev` or `prisma migrate reset`.** Migrations are written by hand in this plan and applied with `npx prisma migrate deploy`. The first migration holds hand-written SQL that a generated migration would drop.
- Bin Omran only: one calendar, bookings carry **no branch**.
- Only a `FULL` booking with status `BOOKED` closes a day; one per `receive_date`. `LIGHT` bookings never close a day and have no limit.
- All dates are Qatar calendar days as `YYYY-MM-DD` strings in JSON and `DATE` columns in the database. "Today" is the Qatar date (UTC+3, no DST). Never build a `Date` from a day string with the local time zone.
- Field limits (shared by API and web, in `shared/validation.ts`): car / owner name / salesperson name 2–80 characters; phone optional, `+`, digits and spaces, 6–20 characters; service up to 200; note up to 1,000; close reason up to 200; decision note up to 500; hour `HH:mm`; PIN exactly 6 digits.
- Calendar endpoints accept at most **62 days** per call.
- Sales cookie: `httpOnly`, `SameSite=Strict`, path `/api/slots`, 90 days, JWT audience `slots`. Hint cookie `wc_slots` on `/`.
- PIN lockout reuses `LOGIN_MAX_ATTEMPTS` (5) and `LOGIN_LOCK_MINUTES` (15).
- Error codes are exact: `PPF_DAY_FULL`, `PPF_DAY_CLOSED`, `PPF_DAY_NOT_FULL`, `BOOKING_CANCELLED`, `REQUEST_ALREADY_DECIDED` (all 409), `SALES_PIN_NOT_SET` (409), `SALES_PIN_INVALID` (401), `SALES_PIN_LOCKED` (423), `SALES_ACCESS_REQUIRED` (401), `BAD_RANGE`, `DELIVERY_BEFORE_RECEIVE`, `REQUEST_DAY_PAST`, `NOTHING_TO_UPDATE` (all 400).
- Every state-changing route carries `@Audit(...)`. Audit actions are exact (see each task) and unique. The PIN must never reach the activity log.
- Every new route is added to `api/test/rbac-matrix.e2e-spec.ts` in the task that creates it; that suite fails on any route it does not list.
- Every user-visible string exists in both `messages/app/en/` and `messages/app/ar/`.
- Calendar weeks start on **Saturday**.
- Inside a `<form>`, every `<Button>` that is not the submit button carries `type="button"`.
- Component tests have no toast container: anything a test must see (a refusal, a validation message) is rendered on the page with `role="alert"`, not only sent to `toast`.
- Match the surrounding code: 2-space indent, single quotes in `api/`, double quotes in the web app, comments only where the neighbours have them.
- Commit after every task with the message given, ending with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**One deliberate difference from the spec's testing section:** the sales routes are `@Public()` (they use a cookie, not a bearer token), so in the RBAC matrix they are listed as `{ public: <status> }` rows rather than through a new `sales` caller. The cookie itself is covered by `api/test/slots.e2e-spec.ts` (Task 6).

## Commands

```bash
# databases (once per machine session)
docker compose up -d db db-test

# API (run inside api/)
npm test -- <path-or-pattern>          # unit (no database)
npm run test:e2e -- <file>             # e2e against TEST_DATABASE_URL
npm run typecheck && npm run lint

# web (run at the repo root)
npm test -- <path>                     # Vitest
npm run typecheck && npm run lint
```

## Review Focus

1. **A day string that is not a real date** (`2026-02-30`, `2026-13-01`) — expected: `400 VALIDATION_FAILED`, never a 500 or a silently shifted date. Test in Task 3.
2. **Phone typed with Arabic-Indic digits** (`٥٥١٢٣٤٥٦`, the default on an Arabic phone keyboard) — expected: accepted and stored as `55123456`. Test in Task 3 (transform) and Task 4 (service receives the normalised value).
3. **Re-booking a day after its full PPF was cancelled, and moving a full PPF onto an occupied day** — expected: the first succeeds, the second is `409 PPF_DAY_FULL`. Tests in Task 4 (e2e).
4. **Just after midnight in Qatar** (21:30 UTC the previous day) — expected: "today" is already the new Qatar day, so a sales request for the old day is refused and dates round-trip unchanged even though the test database's session time zone is Asia/Qatar. Tests in Task 3 (unit) and Task 4 (e2e round trip).
5. **The PIN changes while a salesperson's page is open** — expected: the next refresh shows the PIN screen again, with no crash and no stale customer data left on screen. Test in Task 6 (API) and Task 13 (web).

## File Structure

```
shared/permissions.ts                    + RESERVATIONS role, booking group, 3 permissions
shared/validation.ts                     + booking field limits and patterns

api/prisma/schema.prisma                 + enums, 5 models, User back-relations
api/prisma/migrations/20261004090000_add_reservations_role/migration.sql
api/prisma/migrations/20261004090100_add_bookings/migration.sql
api/src/common/day.ts                    Qatar day helpers, IsDay, ParseDayPipe, digit normalising
api/src/common/booking-fields.ts         shared DTO field decorators (name, phone, note…)
api/src/ppf/day-state.ts                 pure: day list → OPEN / FULL / CLOSED
api/src/ppf/ppf.view.ts                  selects + view mappers (dashboard and sales shapes)
api/src/ppf/dto/ppf.dto.ts
api/src/ppf/ppf.service.ts               bookings, closed days, requests, sales view
api/src/ppf/ppf.controller.ts            /api/ppf/*
api/src/ppf/ppf.module.ts
api/src/reservations/…                   dto, view, service, controller, module
api/src/sales-access/sales-access.service.ts   PIN, lockout, token
api/src/sales-access/sales-access.guard.ts
api/src/sales-access/sales-access.controller.ts  /api/ppf/sales-access
api/src/sales-access/slots.controller.ts         /api/slots
api/src/sales-access/sales-access.module.ts
api/test/ppf.e2e-spec.ts, slots.e2e-spec.ts, reservations.e2e-spec.ts, reservations-role.e2e-spec.ts

lib/api/types.ts                         + booking types
lib/api/client.ts                        export toApiError
features/bookings/shared/dates.ts        month grid math on day strings
features/bookings/shared/month-calendar.tsx
features/bookings/shared/schemas.ts      zod fields shared by the three forms
features/bookings/ppf/queries.ts         keys + fetchers + usePendingRequests
features/bookings/ppf/booking-form.tsx
features/bookings/ppf/day-panel.tsx
features/bookings/ppf/requests-inbox.tsx
features/bookings/ppf/sales-access-card.tsx
features/bookings/ppf/ppf-bookings-page.tsx
features/bookings/general/reservation-form.tsx, reservations-page.tsx
features/bookings/slots/api.ts, pin-screen.tsx, request-form.tsx, side-panel.tsx, slots-page.tsx
messages/app/{en,ar}/bookings.json       namespaces PpfBookings, Reservations, Slots
app/[locale]/(app)/(staff)/dashboard/ppf-bookings/page.tsx
app/[locale]/(app)/(staff)/dashboard/reservations/page.tsx
app/[locale]/(app)/slots/page.tsx
e2e/bookings.spec.ts
```

---

### Task 1: Reservations role and booking permissions

**Files:**
- Modify: `shared/permissions.ts`
- Modify: `api/prisma/schema.prisma` (enum `Role`)
- Create: `api/prisma/migrations/20261004090000_add_reservations_role/migration.sql`
- Modify: `api/src/users/username.ts`, `api/src/users/username.spec.ts`
- Modify: `api/src/users/dto/users.dto.ts`
- Modify: `api/test/utils/fixtures.ts`, `api/test/rbac-matrix.e2e-spec.ts`
- Create: `api/test/reservations-role.e2e-spec.ts`
- Modify: `features/auth/navigation.ts`, `features/auth/navigation.test.tsx`
- Modify: `features/admin/users/user-forms.tsx`
- Modify: `messages/app/{en,ar}/common.json`, `users.json`, `permissions.json`

**Interfaces:**
- Produces: `RoleName` includes `'RESERVATIONS'`; `PermissionKey` includes `'booking.ppf.read' | 'booking.ppf.manage' | 'booking.general.manage'`; `PermissionGroup` includes `'booking'`. Test fixture `PW.reservations` and `World.reservationsId`; the seeded test user's username is `reservations`. RBAC matrix caller `'reservations'`.

- [ ] **Step 1: Write the failing tests**

Append to `api/src/users/username.spec.ts`, inside its top-level `describe`:

```ts
  it('names the reservations account "reservations"', () => {
    expect(baseUsername('RESERVATIONS')).toBe('reservations');
  });
```

(If `baseUsername` is not yet imported in that file, add it to the existing import from `./username`.)

In `features/auth/navigation.test.tsx`, add one line to the test `sends each role to its own dashboard`:

```ts
    expect(homePath("RESERVATIONS")).toBe("/dashboard/ppf-bookings");
```

Create `api/test/reservations-role.e2e-spec.ts`:

```ts
import { createTestApp, type TestApp } from './utils/app';
import { bearer, login } from './utils/auth';
import { PW, seedWorld } from './utils/fixtures';

describe('Reservations role (e2e)', () => {
  let t: TestApp;
  let admin: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await seedWorld(t.prisma);
    admin = (await login(t, 'admin', PW.admin)).token;
  });
  afterAll(async () => {
    await t.close();
  });

  it('the Super Admin creates a Reservations account without a branch', async () => {
    // the seeded one already owns "reservations", so the new one gets a suffix
    const res = await t.http().post('/api/users').set(bearer(admin)).send({ displayName: 'Amani', role: 'RESERVATIONS' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('RESERVATIONS');
    expect(res.body.user.branch).toBeNull();
    expect(res.body.credentials.username).toMatch(/^reservations\.[a-z0-9]{4}$/);
  });

  it('the role holds exactly the three booking permissions by default', async () => {
    const me = await login(t, 'reservations', PW.reservations);
    const user = me.body.user as { role: string; permissions: string[] };
    expect(user.role).toBe('RESERVATIONS');
    expect([...user.permissions].sort()).toEqual(['booking.general.manage', 'booking.ppf.manage', 'booking.ppf.read']);
  });

  it('the Super Admin holds the booking permissions too', async () => {
    const me = await login(t, 'admin', PW.admin);
    expect((me.body.user as { permissions: string[] }).permissions).toEqual(
      expect.arrayContaining(['booking.ppf.read', 'booking.ppf.manage', 'booking.general.manage']),
    );
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd api && npm test -- username.spec` → FAIL (TypeScript: `'RESERVATIONS'` is not assignable to `Role`).
Run (repo root): `npm test -- features/auth/navigation.test.tsx` → FAIL (type error / `undefined`).

- [ ] **Step 3: Add the role and permissions to the shared file**

In `shared/permissions.ts` replace the matching lines:

```ts
export const ROLES = ['SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER', 'CASHIER', 'RESERVATIONS'] as const;
```

```ts
export const PERMISSION_GROUPS = ['product', 'order', 'booking', 'admin', 'account'] as const;
```

Add these three entries to `PERMISSIONS`, directly after `'order.receipt.download'`:

```ts
  'booking.ppf.read': { group: 'booking', description: 'View the PPF calendar, bookings and light-job requests' },
  'booking.ppf.manage': {
    group: 'booking',
    description: 'Add, edit and cancel PPF bookings; close and reopen days; answer requests; set the sales PIN',
  },
  'booking.general.manage': { group: 'booking', description: 'View and manage general reservations' },
```

Add to `DEFAULT_ROLE_PERMISSIONS`, after the `CASHIER` entry:

```ts
  RESERVATIONS: ['booking.ppf.read', 'booking.ppf.manage', 'booking.general.manage'],
```

- [ ] **Step 4: Database enum**

In `api/prisma/schema.prisma`, add `RESERVATIONS` as the last value of `enum Role`.

Create `api/prisma/migrations/20261004090000_add_reservations_role/migration.sql`:

```sql
-- The call-center role that manages PPF bookings and general reservations.
-- It has no branch: users_role_branch_check already requires branch_id IS NULL
-- for every role other than BRANCH_MANAGER and CASHIER.
ALTER TYPE "Role" ADD VALUE 'RESERVATIONS';
```

Run:

```bash
cd api && npx prisma migrate deploy && npx prisma generate
DATABASE_URL="$(grep '^TEST_DATABASE_URL=' .env | cut -d= -f2-)" npx prisma migrate deploy
```

Expected: `1 migration applied` twice (dev and test databases). If `TEST_DATABASE_URL` is not in `.env`, check `api/test/setup/` for how the e2e suite migrates the test database and use that instead.

- [ ] **Step 5: API code that switches on the role**

`api/src/users/username.ts` — add a case to `baseUsername` and update its doc comment to include `"reservations"`:

```ts
    case 'RESERVATIONS':
      return 'reservations';
```

`api/src/users/dto/users.dto.ts`:

```ts
/** Roles that are not tied to a branch. Branch staff are created with their branch. */
export const NON_BRANCH_ROLES = ['SUPER_ADMIN', 'FINANCE', 'RESERVATIONS'] as const;
```

Run `cd api && npm run typecheck`. Fix any other `switch`/`Record<Role, …>` the compiler reports as non-exhaustive by adding the `RESERVATIONS` case next to `FINANCE`'s (same behaviour as Finance: a non-branch account).

- [ ] **Step 6: Test fixtures and the RBAC matrix**

`api/test/utils/fixtures.ts`:

```ts
export const PW = {
  admin: 'SuperWolf#2026!',
  finance: 'Ledger#Wolf2026!',
  manager: 'Manager#Wolf2026!',
  cashier: 'Cashier#Wolf2026!',
  showroom: 'Showroom#2026!',
  reservations: 'Booking#Wolf2026!',
} as const;
```

Add `reservationsId: string;` to `World`, create the user right after `finance` in `seedWorld`, and return its id:

```ts
  const reservations = await prisma.user.create({
    data: { username: 'reservations', displayName: 'Reservations', role: 'RESERVATIONS', passwordHash: h.reservations },
  });
```

```ts
  return { adminId: admin.id, financeId: finance.id, reservationsId: reservations.id, bo, gh, products };
```

`api/test/rbac-matrix.e2e-spec.ts`:

```ts
type Caller = 'anon' | 'admin' | 'finance' | 'manager' | 'cashier' | 'reservations' | 'kiosk';
const DASHBOARD: Caller[] = ['admin', 'finance', 'manager', 'cashier', 'reservations'];
```

and in `beforeAll`, after the cashier login:

```ts
    tokens.reservations = (await login(t, 'reservations', PW.reservations)).token;
```

- [ ] **Step 7: Web — landing page, user form, texts**

`features/auth/navigation.ts`, in `homePath`:

```ts
    case "RESERVATIONS":
      return "/dashboard/ppf-bookings";
```

`features/admin/users/user-forms.tsx`:

```ts
export const ACCOUNT_ROLES = ["SUPER_ADMIN", "FINANCE", "RESERVATIONS"] as const satisfies readonly RoleName[];
```

Add below `isAccountRole`:

```ts
const ROLE_HINT: Record<AccountRole, string> = {
  SUPER_ADMIN: "Users.roleSuperAdminHint",
  FINANCE: "Users.roleFinanceHint",
  RESERVATIONS: "Users.roleReservationsHint",
};
```

and replace every `hint={t(role === "SUPER_ADMIN" ? "Users.roleSuperAdminHint" : "Users.roleFinanceHint")}` in the file with `hint={t(ROLE_HINT[role])}`.

Messages — add these keys (keep each file's existing key order; put new keys next to their siblings):

| File | Key | English | Arabic |
|---|---|---|---|
| `common.json` | `roles.RESERVATIONS` | `Reservations` | `الحجوزات` |
| `users.json` | `roleReservationsHint` | `Manages PPF bookings and general reservations.` | `يدير حجوزات الحماية PPF والحجوزات العامة.` |
| `users.json` | `createHint` (replace) | `Super Admin, Finance and Reservations accounts. A username and a password are generated for you.` | `حسابات المشرف العام والمالية والحجوزات. يُنشأ اسم المستخدم وكلمة المرور تلقائيًا.` |
| `permissions.json` | `groups.booking` | `Bookings` | `الحجوزات` |
| `permissions.json` | `labels.booking_ppf_read` | `View PPF bookings` | `عرض حجوزات PPF` |
| `permissions.json` | `labels.booking_ppf_manage` | `Manage PPF bookings` | `إدارة حجوزات PPF` |
| `permissions.json` | `labels.booking_general_manage` | `Manage general reservations` | `إدارة الحجوزات العامة` |

In both `permissions.json` files put `groups.booking` between `order` and `admin`.

- [ ] **Step 8: Run everything**

```bash
cd api && npm run typecheck && npm test -- username.spec && npm run test:e2e -- reservations-role rbac-matrix
cd .. && npm run typecheck && npm test
```

Expected: all pass. If an existing web test counts the role choices in the user form (two before, three now), update that count.

- [ ] **Step 9: Commit**

```bash
git add shared api/prisma api/src/users api/test features messages
git commit -m "feat: Reservations role with booking permissions"
```

---

### Task 2: Booking tables

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20261004090100_add_bookings/migration.sql`
- Modify: `api/test/utils/fixtures.ts` (`resetDatabase`), `api/prisma/seed.ts` (the `TRUNCATE` list)
- Create: `api/test/bookings-db.e2e-spec.ts`

**Interfaces:**
- Produces: Prisma models `PpfBooking`, `PpfClosedDay`, `LightJobRequest`, `GeneralReservation`, `SalesAccess`; enums `PpfBookingType` (`FULL`, `LIGHT`), `BookingStatus` (`BOOKED`, `CANCELLED`), `LightJobRequestStatus` (`PENDING`, `APPROVED`, `REJECTED`). Unique index name `ppf_bookings_one_full_per_day`.

- [ ] **Step 1: Write the failing test**

Create `api/test/bookings-db.e2e-spec.ts`:

```ts
import { createTestApp, type TestApp } from './utils/app';
import { seedWorld, type World } from './utils/fixtures';

/** Rules the database enforces on its own, whatever the application does. */
describe('Booking tables: database constraints (e2e)', () => {
  let t: TestApp;
  let world: World;
  const day = new Date('2026-11-02T00:00:00.000Z');

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    world = await seedWorld(t.prisma);
  });
  afterAll(async () => {
    await t.close();
  });

  const booking = (over: Record<string, unknown> = {}) =>
    t.prisma.ppfBooking.create({
      data: { type: 'FULL', car: 'Land Cruiser', ownerName: 'Khalid', receiveDate: day, createdById: world.reservationsId, ...over },
    });

  it('refuses a second active full PPF on the same day', async () => {
    await booking();
    await expect(booking()).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows light jobs, and a new full PPF once the first is cancelled', async () => {
    const first = await booking();
    await booking({ type: 'LIGHT' });
    await booking({ type: 'LIGHT' });
    await t.prisma.ppfBooking.update({ where: { id: first.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    await expect(booking()).resolves.toMatchObject({ type: 'FULL', status: 'BOOKED' });
  });

  it('refuses a delivery day before the receive day', async () => {
    await expect(booking({ deliveryDate: new Date('2026-11-01T00:00:00.000Z') })).rejects.toThrow();
  });

  it('keeps status and cancelled_at in step', async () => {
    await expect(booking({ status: 'CANCELLED' })).rejects.toThrow();
    await expect(booking({ cancelledAt: new Date() })).rejects.toThrow();
  });

  it('stores a day without shifting it (session time zone is Asia/Qatar)', async () => {
    const row = await booking();
    const [raw] = await t.prisma.$queryRaw<{ d: string }[]>`SELECT receive_date::text AS d FROM ppf_bookings WHERE id = ${row.id}::uuid`;
    expect(raw.d).toBe('2026-11-02');
    expect(row.receiveDate.toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it('holds a single sales-access row', async () => {
    await t.prisma.salesAccess.create({ data: {} });
    await expect(t.prisma.salesAccess.create({ data: { id: 2 } })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd api && npm run test:e2e -- bookings-db` → FAIL (`t.prisma.ppfBooking` does not exist).

- [ ] **Step 3: Prisma schema**

In `api/prisma/schema.prisma`, add after `enum AuditOutcome`:

```prisma
enum PpfBookingType {
  FULL
  LIGHT
}

enum BookingStatus {
  BOOKED
  CANCELLED
}

enum LightJobRequestStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Add these relation fields to `model User`, after `ordersCancelled`:

```prisma
  ppfBookingsCreated    PpfBooking[]         @relation("PpfBookingCreatedBy")
  ppfBookingsUpdated    PpfBooking[]         @relation("PpfBookingUpdatedBy")
  ppfBookingsCancelled  PpfBooking[]         @relation("PpfBookingCancelledBy")
  ppfDaysClosed         PpfClosedDay[]
  lightRequestsDecided  LightJobRequest[]
  reservationsCreated   GeneralReservation[] @relation("ReservationCreatedBy")
  reservationsUpdated   GeneralReservation[] @relation("ReservationUpdatedBy")
  reservationsCancelled GeneralReservation[] @relation("ReservationCancelledBy")
  salesAccessUpdates    SalesAccess[]
```

Add before `model ActivityLog`:

```prisma
/// A car booked for PPF or tinting at Bin Omran (the only branch that does it).
/// One active FULL booking per receive_date — a partial unique index in SQL.
model PpfBooking {
  id            String         @id @default(uuid()) @db.Uuid
  type          PpfBookingType
  status        BookingStatus  @default(BOOKED)
  car           String         @db.VarChar(80)
  ownerName     String         @map("owner_name") @db.VarChar(80)
  phone         String?        @db.VarChar(20)
  service       String?        @db.VarChar(200)
  /// The day the car arrives. This is the day a FULL booking closes.
  receiveDate   DateTime       @map("receive_date") @db.Date
  /// Information only; closes nothing.
  deliveryDate  DateTime?      @map("delivery_date") @db.Date
  note          String?        @db.VarChar(1000)
  createdById   String         @map("created_by_id") @db.Uuid
  updatedById   String?        @map("updated_by_id") @db.Uuid
  cancelledById String?        @map("cancelled_by_id") @db.Uuid
  cancelledAt   DateTime?      @map("cancelled_at") @db.Timestamptz(3)
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime       @updatedAt @map("updated_at") @db.Timestamptz(3)

  createdBy   User             @relation("PpfBookingCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  updatedBy   User?            @relation("PpfBookingUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)
  cancelledBy User?            @relation("PpfBookingCancelledBy", fields: [cancelledById], references: [id], onDelete: SetNull)
  request     LightJobRequest?

  @@index([receiveDate])
  @@map("ppf_bookings")
}

/// A day the call center closed by hand (holiday, workshop full).
model PpfClosedDay {
  date        DateTime @id @db.Date
  reason      String?  @db.VarChar(200)
  createdById String   @map("created_by_id") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  createdBy User @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@map("ppf_closed_days")
}

/// A salesperson asking the call center to fit a light job into a day closed by a full PPF.
model LightJobRequest {
  id           String                @id @default(uuid()) @db.Uuid
  date         DateTime              @db.Date
  /// Typed by the salesperson; sales have no accounts.
  salesName    String                @map("sales_name") @db.VarChar(80)
  car          String                @db.VarChar(80)
  ownerName    String                @map("owner_name") @db.VarChar(80)
  phone        String?               @db.VarChar(20)
  note         String                @db.VarChar(1000)
  status       LightJobRequestStatus @default(PENDING)
  decidedById  String?               @map("decided_by_id") @db.Uuid
  decidedAt    DateTime?             @map("decided_at") @db.Timestamptz(3)
  decisionNote String?               @map("decision_note") @db.VarChar(500)
  /// The light job created when the request was approved.
  bookingId    String?               @unique @map("booking_id") @db.Uuid
  createdAt    DateTime              @default(now()) @map("created_at") @db.Timestamptz(3)

  decidedBy User?       @relation(fields: [decidedById], references: [id], onDelete: SetNull)
  booking   PpfBooking? @relation(fields: [bookingId], references: [id], onDelete: SetNull)

  @@index([status, createdAt])
  @@map("light_job_requests")
}

/// The call center's private list of every other reservation. No slots.
model GeneralReservation {
  id            String        @id @default(uuid()) @db.Uuid
  date          DateTime      @db.Date
  /// "HH:mm" in Qatar time, when an hour was agreed.
  time          String?       @db.VarChar(5)
  service       String        @db.VarChar(200)
  ownerName     String?       @map("owner_name") @db.VarChar(80)
  phone         String?       @db.VarChar(20)
  car           String?       @db.VarChar(80)
  note          String?       @db.VarChar(1000)
  status        BookingStatus @default(BOOKED)
  createdById   String        @map("created_by_id") @db.Uuid
  updatedById   String?       @map("updated_by_id") @db.Uuid
  cancelledById String?       @map("cancelled_by_id") @db.Uuid
  cancelledAt   DateTime?     @map("cancelled_at") @db.Timestamptz(3)
  createdAt     DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime      @updatedAt @map("updated_at") @db.Timestamptz(3)

  createdBy   User  @relation("ReservationCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  updatedBy   User? @relation("ReservationUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)
  cancelledBy User? @relation("ReservationCancelledBy", fields: [cancelledById], references: [id], onDelete: SetNull)

  @@index([date])
  @@map("general_reservations")
}

/// One row (id = 1): the shared PIN of the sales slots page.
model SalesAccess {
  id          Int       @id @default(1)
  pinHash     String?   @map("pin_hash")
  /// Bumped on every PIN change; cookies carrying an older version stop working.
  version     Int       @default(1)
  failedCount Int       @default(0) @map("failed_count")
  lockedUntil DateTime? @map("locked_until") @db.Timestamptz(3)
  updatedById String?   @map("updated_by_id") @db.Uuid
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  updatedBy User? @relation(fields: [updatedById], references: [id], onDelete: SetNull)

  @@map("sales_access")
}
```

- [ ] **Step 4: The migration**

Create `api/prisma/migrations/20261004090100_add_bookings/migration.sql`:

```sql
CREATE TYPE "PpfBookingType" AS ENUM ('FULL', 'LIGHT');
CREATE TYPE "BookingStatus" AS ENUM ('BOOKED', 'CANCELLED');
CREATE TYPE "LightJobRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ppf_bookings" (
    "id" UUID NOT NULL,
    "type" "PpfBookingType" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'BOOKED',
    "car" VARCHAR(80) NOT NULL,
    "owner_name" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(20),
    "service" VARCHAR(200),
    "receive_date" DATE NOT NULL,
    "delivery_date" DATE,
    "note" VARCHAR(1000),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ppf_bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ppf_closed_days" (
    "date" DATE NOT NULL,
    "reason" VARCHAR(200),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ppf_closed_days_pkey" PRIMARY KEY ("date")
);

CREATE TABLE "light_job_requests" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "sales_name" VARCHAR(80) NOT NULL,
    "car" VARCHAR(80) NOT NULL,
    "owner_name" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(20),
    "note" VARCHAR(1000) NOT NULL,
    "status" "LightJobRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_note" VARCHAR(500),
    "booking_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "light_job_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "general_reservations" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "time" VARCHAR(5),
    "service" VARCHAR(200) NOT NULL,
    "owner_name" VARCHAR(80),
    "phone" VARCHAR(20),
    "car" VARCHAR(80),
    "note" VARCHAR(1000),
    "status" "BookingStatus" NOT NULL DEFAULT 'BOOKED',
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "general_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_access" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "pin_hash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "sales_access_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ppf_bookings_receive_date_idx" ON "ppf_bookings"("receive_date");
CREATE UNIQUE INDEX "light_job_requests_booking_id_key" ON "light_job_requests"("booking_id");
CREATE INDEX "light_job_requests_status_created_at_idx" ON "light_job_requests"("status", "created_at");
CREATE INDEX "general_reservations_date_idx" ON "general_reservations"("date");

ALTER TABLE "ppf_bookings" ADD CONSTRAINT "ppf_bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ppf_bookings" ADD CONSTRAINT "ppf_bookings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ppf_bookings" ADD CONSTRAINT "ppf_bookings_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ppf_closed_days" ADD CONSTRAINT "ppf_closed_days_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "light_job_requests" ADD CONSTRAINT "light_job_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "light_job_requests" ADD CONSTRAINT "light_job_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "ppf_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "general_reservations" ADD CONSTRAINT "general_reservations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_reservations" ADD CONSTRAINT "general_reservations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "general_reservations" ADD CONSTRAINT "general_reservations_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_access" ADD CONSTRAINT "sales_access_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written constraints (not expressible in the Prisma schema).
-- ---------------------------------------------------------------------------

-- One active full PPF per day. Light jobs and cancelled bookings don't count.
CREATE UNIQUE INDEX "ppf_bookings_one_full_per_day" ON "ppf_bookings" ("receive_date")
  WHERE type = 'FULL' AND status = 'BOOKED';

ALTER TABLE "ppf_bookings" ADD CONSTRAINT "ppf_bookings_delivery_check"
  CHECK (delivery_date IS NULL OR delivery_date >= receive_date);
ALTER TABLE "ppf_bookings" ADD CONSTRAINT "ppf_bookings_cancelled_check"
  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL));
ALTER TABLE "general_reservations" ADD CONSTRAINT "general_reservations_cancelled_check"
  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL));
ALTER TABLE "sales_access" ADD CONSTRAINT "sales_access_single_row_check" CHECK (id = 1);
```

Apply it to both databases and regenerate the client (same commands as Task 1, Step 4).

Then confirm the schema and the SQL agree — this must print an empty diff apart from the hand-written objects above:

```bash
cd api && npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Expected output: only statements that would drop hand-written objects (`ppf_bookings_one_full_per_day` and friends from this and the first migration), or nothing. Any `ALTER TABLE … ADD COLUMN`, type change or index on the five new tables means the SQL above and the schema differ — fix the SQL to match the schema. (If your Prisma version names the flags differently, run `npx prisma migrate diff --help`; the goal is "live database vs. schema file".)

- [ ] **Step 5: Test and seed clean-up lists**

`api/test/utils/fixtures.ts` — in `resetDatabase`, put the new tables at the start of the list (they reference `users`):

```ts
    for (const table of [
      'light_job_requests',
      'ppf_bookings',
      'ppf_closed_days',
      'general_reservations',
      'sales_access',
      'order_items',
```

`api/prisma/seed.ts` — in the `TRUNCATE TABLE activity_logs, order_items, …` statement, add `light_job_requests, ppf_bookings, ppf_closed_days, general_reservations, sales_access, ` right after `activity_logs, `.

- [ ] **Step 6: Run the test**

Run: `cd api && npm run typecheck && npm run test:e2e -- bookings-db` → PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add api/prisma api/test
git commit -m "feat(api): booking tables with one full PPF per day enforced by the database"
```

---

### Task 3: Day helpers, shared field rules and the day-state function

**Files:**
- Modify: `shared/validation.ts`
- Create: `api/src/common/day.ts`, `api/src/common/day.spec.ts`
- Create: `api/src/common/booking-fields.ts`, `api/src/common/booking-fields.spec.ts`
- Create: `api/src/ppf/day-state.ts`, `api/src/ppf/day-state.spec.ts`

**Interfaces:**
- Produces (from `shared/validation.ts`): `BOOKING_NAME_MIN = 2`, `BOOKING_NAME_MAX = 80`, `BOOKING_SERVICE_MAX = 200`, `BOOKING_NOTE_MAX = 1000`, `CLOSE_REASON_MAX = 200`, `DECISION_NOTE_MAX = 500`, `PHONE_PATTERN`, `DAY_PATTERN`, `TIME_PATTERN`, `SALES_PIN_PATTERN`, `CALENDAR_MAX_DAYS = 62`, `normaliseDigits(text: string): string`.
- Produces (from `api/src/common/day.ts`): `toDate(day: string): Date`, `dayStr(date: Date): string`, `isDay(value: unknown): value is string`, `qatarToday(now?: Date): string`, `addDays(day: string, n: number): string`, `daysBetween(from: string, to: string): number`, `eachDay(from: string, to: string): string[]`, decorator `IsDay()`, pipe `ParseDayPipe`.
- Produces (from `api/src/common/booking-fields.ts`): property decorators `NameField()`, `PhoneField()`, `TextField(max: number)`.
- Produces (from `api/src/ppf/day-state.ts`): `type DayState = 'OPEN' | 'FULL' | 'CLOSED'`, `interface DayInfo { date: string; state: DayState; reason: string | null; lightCount: number }`, `dayStates(from: string, to: string, active: { type: 'FULL' | 'LIGHT'; receiveDate: string }[], closed: { date: string; reason: string | null }[]): DayInfo[]`.

- [ ] **Step 1: Write the failing tests**

`api/src/common/day.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { addDays, dayStr, daysBetween, eachDay, IsDay, isDay, ParseDayPipe, qatarToday, toDate } from './day';

class Probe {
  @IsDay()
  day: unknown;
}
const errorsFor = (day: unknown) => validateSync(Object.assign(new Probe(), { day })).length;

describe('Qatar day helpers', () => {
  it('round-trips a day through a UTC-midnight Date', () => {
    expect(toDate('2026-11-02').toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(dayStr(toDate('2026-11-02'))).toBe('2026-11-02');
  });

  it('accepts only real calendar days', () => {
    expect(isDay('2026-02-28')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true); // leap year
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('2026-13-01')).toBe(false);
    expect(isDay('2026-1-5')).toBe(false);
    expect(isDay('2026-11-02T00:00:00Z')).toBe(false);
    expect(isDay(20261102)).toBe(false);
    expect(isDay(null)).toBe(false);
  });

  it('@IsDay rejects impossible days', () => {
    expect(errorsFor('2026-11-02')).toBe(0);
    expect(errorsFor('2026-02-30')).toBe(1);
    expect(errorsFor(undefined)).toBe(1);
  });

  it('ParseDayPipe turns a bad route parameter into a 400', () => {
    const pipe = new ParseDayPipe();
    expect(pipe.transform('2026-11-02')).toBe('2026-11-02');
    expect(() => pipe.transform('2026-02-30')).toThrow(BadRequestException);
  });

  it('"today" follows Qatar time, three hours ahead of UTC', () => {
    expect(qatarToday(new Date('2026-11-01T20:59:59.000Z'))).toBe('2026-11-01');
    expect(qatarToday(new Date('2026-11-01T21:00:00.000Z'))).toBe('2026-11-02');
    expect(qatarToday(new Date('2026-12-31T21:30:00.000Z'))).toBe('2027-01-01');
  });

  it('does day arithmetic across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-01', '2026-11-01')).toBe(0);
    expect(daysBetween('2026-11-01', '2026-12-01')).toBe(30);
    expect(daysBetween('2026-11-02', '2026-11-01')).toBe(-1);
    expect(eachDay('2026-02-27', '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(eachDay('2026-03-02', '2026-03-01')).toEqual([]);
  });
});
```

`api/src/common/booking-fields.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { IsOptional, validateSync } from 'class-validator';
import { NameField, PhoneField, TextField } from './booking-fields';
import { EmptyToNull } from './validators';

class Probe {
  @NameField()
  ownerName: string;

  @IsOptional()
  @EmptyToNull()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToNull()
  @TextField(10)
  note?: string | null;
}

const parse = (raw: Record<string, unknown>) => {
  const probe = plainToInstance(Probe, raw);
  return { probe, fields: validateSync(probe).map((e) => e.property) };
};

describe('booking field decorators', () => {
  it('trims and collapses spaces in names, in any script', () => {
    const { probe, fields } = parse({ ownerName: '  خالد   المري ' });
    expect(fields).toEqual([]);
    expect(probe.ownerName).toBe('خالد المري');
  });

  it('rejects names that are too short or too long', () => {
    expect(parse({ ownerName: 'A' }).fields).toEqual(['ownerName']);
    expect(parse({ ownerName: 'x'.repeat(81) }).fields).toEqual(['ownerName']);
    expect(parse({ ownerName: 42 }).fields).toEqual(['ownerName']);
  });

  it('stores Arabic-Indic and Persian digits as plain digits', () => {
    expect(parse({ ownerName: 'Sara', phone: '٥٥١٢٣٤٥٦' }).probe.phone).toBe('55123456');
    expect(parse({ ownerName: 'Sara', phone: '+۹۷۴ 5512 3456' }).probe.phone).toBe('+974 5512 3456');
  });

  it('treats an empty phone or note as "none"', () => {
    const { probe, fields } = parse({ ownerName: 'Sara', phone: '   ', note: '' });
    expect(fields).toEqual([]);
    expect(probe.phone).toBeNull();
    expect(probe.note).toBeNull();
  });

  it('rejects phones with letters or the wrong length, and long notes', () => {
    expect(parse({ ownerName: 'Sara', phone: 'call me' }).fields).toEqual(['phone']);
    expect(parse({ ownerName: 'Sara', phone: '123' }).fields).toEqual(['phone']);
    expect(parse({ ownerName: 'Sara', note: 'x'.repeat(11) }).fields).toEqual(['note']);
  });
});
```

`api/src/ppf/day-state.spec.ts`:

```ts
import { dayStates } from './day-state';

describe('dayStates', () => {
  const full = (receiveDate: string) => ({ type: 'FULL' as const, receiveDate });
  const light = (receiveDate: string) => ({ type: 'LIGHT' as const, receiveDate });

  it('lists every day of the range, open by default', () => {
    expect(dayStates('2026-11-01', '2026-11-03', [], [])).toEqual([
      { date: '2026-11-01', state: 'OPEN', reason: null, lightCount: 0 },
      { date: '2026-11-02', state: 'OPEN', reason: null, lightCount: 0 },
      { date: '2026-11-03', state: 'OPEN', reason: null, lightCount: 0 },
    ]);
  });

  it('a full PPF closes its day; light jobs only count', () => {
    const days = dayStates('2026-11-01', '2026-11-02', [full('2026-11-01'), light('2026-11-01'), light('2026-11-02'), light('2026-11-02')], []);
    expect(days).toEqual([
      { date: '2026-11-01', state: 'FULL', reason: null, lightCount: 1 },
      { date: '2026-11-02', state: 'OPEN', reason: null, lightCount: 2 },
    ]);
  });

  it('a day closed by hand wins over a full PPF and carries its reason', () => {
    const [day] = dayStates('2026-11-01', '2026-11-01', [full('2026-11-01')], [{ date: '2026-11-01', reason: 'National Day' }]);
    expect(day).toEqual({ date: '2026-11-01', state: 'CLOSED', reason: 'National Day', lightCount: 0 });
  });

  it('ignores bookings and closed days outside the range', () => {
    const days = dayStates('2026-11-02', '2026-11-02', [full('2026-11-01')], [{ date: '2026-11-03', reason: null }]);
    expect(days).toEqual([{ date: '2026-11-02', state: 'OPEN', reason: null, lightCount: 0 }]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd api && npm test -- common/day common/booking-fields ppf/day-state` → FAIL (modules not found).

- [ ] **Step 3: Shared rules**

Append to `shared/validation.ts` (the file must stay free of imports):

```ts
/** Bookings and reservations: car, owner name and salesperson name. */
export const BOOKING_NAME_MIN = 2;
export const BOOKING_NAME_MAX = 80;
export const BOOKING_SERVICE_MAX = 200;
export const BOOKING_NOTE_MAX = 1000;
export const CLOSE_REASON_MAX = 200;
export const DECISION_NOTE_MAX = 500;
/** Local or international: optional "+", then digits and spaces. */
export const PHONE_PATTERN = /^\+?[0-9 ]{6,20}$/;
/** A Qatar calendar day, "2026-11-02". The API also checks it is a real date. */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const SALES_PIN_PATTERN = /^\d{6}$/;
/** Most days one calendar request may cover (a month view plus its edges). */
export const CALENDAR_MAX_DAYS = 62;

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits as typed on Arabic keyboards → 0-9. */
export function normaliseDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));
}
```

(`٠` is `0x0660` and `۰` is `0x06F0`, so the low four bits are the digit in both ranges.)

- [ ] **Step 4: Day helpers**

Create `api/src/common/day.ts`:

```ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { DAY_PATTERN } from '../../../shared/validation';

const DAY_MS = 86_400_000;
/** Qatar is UTC+3 all year (no daylight saving). */
const QATAR_OFFSET_MS = 3 * 3_600_000;

/**
 * Calendar days travel as "YYYY-MM-DD" strings and live in DATE columns, which
 * Prisma reads and writes as a Date at UTC midnight. They are never converted
 * through a local time zone.
 */
export const toDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);
export const dayStr = (date: Date): string => date.toISOString().slice(0, 10);

/** A well-formed day that also exists (so not 2026-02-30). */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  const date = toDate(value);
  return !Number.isNaN(date.getTime()) && dayStr(date) === value;
}

export const qatarToday = (now: Date = new Date()): string => dayStr(new Date(now.getTime() + QATAR_OFFSET_MS));
export const addDays = (day: string, n: number): string => dayStr(new Date(toDate(day).getTime() + n * DAY_MS));
/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const daysBetween = (from: string, to: string): number => Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);

/** Every day from `from` to `to`, both included. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export function IsDay(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isDay',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => isDay(value),
        defaultMessage: (args: ValidationArguments) => `${args.property} must be a real date in the form YYYY-MM-DD`,
      },
    });
}

/** ":date" route segment → validated day string. */
@Injectable()
export class ParseDayPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isDay(value)) throw new BadRequestException('date must be a real date in the form YYYY-MM-DD');
    return value;
  }
}
```

- [ ] **Step 5: Field decorators**

Create `api/src/common/booking-fields.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { BOOKING_NAME_MAX, BOOKING_NAME_MIN, normaliseDigits, PHONE_PATTERN } from '../../../shared/validation';

type Decorate = (target: object, key: string) => void;

const collapse = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const phone = ({ value }: { value: unknown }) => (typeof value === 'string' ? normaliseDigits(value).trim().replace(/\s+/g, ' ') : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Car, owner name, salesperson name: free text in any script, 2–80 characters. */
export const NameField = (): Decorate => (target, key) => {
  Transform(collapse)(target, key);
  IsString()(target, key);
  MinLength(BOOKING_NAME_MIN)(target, key);
  MaxLength(BOOKING_NAME_MAX)(target, key);
};

/** Digits typed on an Arabic keyboard are stored as 0-9. */
export const PhoneField = (): Decorate => (target, key) => {
  Transform(phone)(target, key);
  IsString()(target, key);
  Matches(PHONE_PATTERN, { message: `${key} may contain an optional +, digits and spaces (6–20 characters)` })(target, key);
};

/** Free text with a length limit (service, note, reason). */
export const TextField = (max: number): Decorate => (target, key) => {
  Transform(trim)(target, key);
  IsString()(target, key);
  MinLength(1)(target, key);
  MaxLength(max)(target, key);
};
```

These are stacked under `@IsOptional()` with `@EmptyToNull()` (update DTOs) or `@EmptyToUndefined()` (create DTOs) from `api/src/common/validators.ts`: class-transformer runs the lowest decorator first, so the field's own transform trims the text and the `EmptyTo…` above it then turns `""` into "none".

- [ ] **Step 6: Day state**

Create `api/src/ppf/day-state.ts`:

```ts
import { eachDay } from '../common/day';

export type DayState = 'OPEN' | 'FULL' | 'CLOSED';

export interface DayInfo {
  date: string;
  state: DayState;
  /** why the call center closed the day (CLOSED only) */
  reason: string | null;
  lightCount: number;
}

/**
 * The one place that decides what a day looks like, for the dashboard and the
 * sales page alike. A day closed by hand is CLOSED even when it also holds a
 * full PPF; otherwise a full PPF makes it FULL; otherwise it is OPEN.
 * `active` must hold only bookings that are not cancelled.
 */
export function dayStates(
  from: string,
  to: string,
  active: { type: 'FULL' | 'LIGHT'; receiveDate: string }[],
  closed: { date: string; reason: string | null }[],
): DayInfo[] {
  const full = new Set(active.filter((b) => b.type === 'FULL').map((b) => b.receiveDate));
  const light = new Map<string, number>();
  for (const b of active) if (b.type === 'LIGHT') light.set(b.receiveDate, (light.get(b.receiveDate) ?? 0) + 1);
  const closedBy = new Map(closed.map((c) => [c.date, c.reason]));

  return eachDay(from, to).map((date) => {
    const isClosed = closedBy.has(date);
    return {
      date,
      state: isClosed ? 'CLOSED' : full.has(date) ? 'FULL' : 'OPEN',
      reason: isClosed ? (closedBy.get(date) ?? null) : null,
      lightCount: light.get(date) ?? 0,
    };
  });
}
```

- [ ] **Step 7: Run the tests**

Run: `cd api && npm test -- common/day common/booking-fields ppf/day-state && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 8: Commit**

```bash
git add shared/validation.ts api/src/common api/src/ppf
git commit -m "feat(api): Qatar day helpers, booking field rules and the day-state function"
```

---

### Task 4: PPF bookings, closed days and the calendar (API)

**Files:**
- Create: `api/src/ppf/ppf.view.ts`, `api/src/ppf/dto/ppf.dto.ts`, `api/src/ppf/ppf.service.ts`, `api/src/ppf/ppf.controller.ts`, `api/src/ppf/ppf.module.ts`
- Create: `api/src/ppf/ppf.service.spec.ts`, `api/test/ppf.e2e-spec.ts`
- Modify: `api/src/app.module.ts`, `api/test/rbac-matrix.e2e-spec.ts`

**Interfaces:**
- Consumes: `toDate`, `dayStr`, `daysBetween`, `qatarToday`, `IsDay`, `ParseDayPipe` (`common/day.ts`); `NameField`, `PhoneField`, `TextField` (`common/booking-fields.ts`); `dayStates`, `DayInfo` (`ppf/day-state.ts`); `AuditTrail`; `PrismaService`.
- Produces:
  - `PpfBookingView = { id: string; type: 'FULL' | 'LIGHT'; status: 'BOOKED' | 'CANCELLED'; car: string; ownerName: string; phone: string | null; service: string | null; receiveDate: string; deliveryDate: string | null; note: string | null; requestedBy: string | null; createdBy: { id: string; displayName: string }; createdAt: Date; cancelledAt: Date | null }`
  - `PpfService.calendar(q: { from: string; to: string }): Promise<{ today: string; days: DayInfo[]; bookings: PpfBookingView[] }>`
  - `PpfService.list(q: ListPpfBookingsQueryDto): Promise<Page<PpfBookingView>>`
  - `PpfService.create(user: AuthUser, dto: CreatePpfBookingDto): Promise<PpfBookingView>`
  - `PpfService.update(user: AuthUser, id: string, dto: UpdatePpfBookingDto): Promise<PpfBookingView>`
  - `PpfService.cancel(user: AuthUser, id: string): Promise<PpfBookingView>`
  - `PpfService.closeDay(user: AuthUser, date: string, dto: CloseDayDto): Promise<{ date: string; reason: string | null }>`
  - `PpfService.reopenDay(date: string): Promise<void>`
  - exported helpers in `ppf.service.ts`: `conflict(code: string, message: string): ConflictException`, `bad(code: string, message: string): BadRequestException`
  - `CalendarQueryDto { from: string; to: string }` (reused by Task 6)
  - Routes: `GET /api/ppf/calendar`, `GET|POST /api/ppf/bookings`, `PATCH /api/ppf/bookings/:id`, `POST /api/ppf/bookings/:id/cancel`, `PUT|DELETE /api/ppf/closed-days/:date`
  - Audit actions: `ppf_booking.create`, `ppf_booking.update`, `ppf_booking.cancel`, `ppf_day.close`, `ppf_day.reopen`

- [ ] **Step 1: Write the failing unit test**

Create `api/src/ppf/ppf.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { PpfService } from './ppf.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'b-1',
  type: 'FULL',
  status: 'BOOKED',
  car: 'Land Cruiser',
  ownerName: 'Khalid',
  phone: null,
  service: null,
  receiveDate: new Date('2026-11-02T00:00:00.000Z'),
  deliveryDate: null,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  cancelledAt: null,
  createdBy: { id: 'u-1', displayName: 'Amani' },
  request: null,
  ...over,
});

const duplicate = () => new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
const code = (c: string) => ({ response: { code: c } });

describe('PpfService: bookings and days', () => {
  const prisma = mockDeep<PrismaService>();
  const trail = mock<AuditTrail>();
  const service = new PpfService(prisma, trail);
  const amani = authUser({ id: 'u-1', role: 'RESERVATIONS', branchId: null }, ['booking.ppf.read', 'booking.ppf.manage']);
  const dto = { type: 'FULL' as const, car: 'Land Cruiser', ownerName: 'Khalid', receiveDate: '2026-11-02' };

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'setBranch', 'addMetadata'] as const) trail[m].mockReturnValue(trail);
    prisma.ppfClosedDay.findUnique.mockResolvedValue(null);
  });

  it('creates a booking on an open day and records it for the audit log', async () => {
    prisma.ppfBooking.create.mockResolvedValue(row() as never);
    const view = await service.create(amani, { ...dto, phone: '55123456', deliveryDate: '2026-11-05' });
    expect(prisma.ppfBooking.create.mock.calls[0][0].data).toMatchObject({
      type: 'FULL',
      phone: '55123456',
      receiveDate: new Date('2026-11-02T00:00:00.000Z'),
      deliveryDate: new Date('2026-11-05T00:00:00.000Z'),
      createdById: 'u-1',
    });
    expect(view.receiveDate).toBe('2026-11-02');
    expect(trail.setEntity).toHaveBeenCalledWith('PpfBooking', 'b-1');
  });

  it('refuses a second full PPF on the day (the database index decides)', async () => {
    prisma.ppfBooking.create.mockRejectedValue(duplicate());
    await expect(service.create(amani, dto)).rejects.toMatchObject(code('PPF_DAY_FULL'));
  });

  it('refuses any booking on a day closed by hand, without touching the table', async () => {
    prisma.ppfClosedDay.findUnique.mockResolvedValue({ date: new Date(), reason: null } as never);
    await expect(service.create(amani, { ...dto, type: 'LIGHT' })).rejects.toMatchObject(code('PPF_DAY_CLOSED'));
    expect(prisma.ppfBooking.create).not.toHaveBeenCalled();
  });

  it('refuses a delivery day before the receive day', async () => {
    await expect(service.create(amani, { ...dto, deliveryDate: '2026-11-01' })).rejects.toMatchObject(code('DELIVERY_BEFORE_RECEIVE'));
  });

  it('moving a booking checks the new day, and keeps a delivery day that is still valid', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(row({ deliveryDate: new Date('2026-11-10T00:00:00.000Z') }) as never);
    prisma.ppfBooking.updateMany.mockResolvedValue({ count: 1 });
    await service.update(amani, 'b-1', { receiveDate: '2026-11-04' });
    expect(prisma.ppfClosedDay.findUnique).toHaveBeenCalledWith({ where: { date: new Date('2026-11-04T00:00:00.000Z') } });
    expect(prisma.ppfBooking.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'b-1', status: 'BOOKED' },
      data: { receiveDate: new Date('2026-11-04T00:00:00.000Z'), updatedById: 'u-1' },
    });
  });

  it('moving past the delivery day is refused', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(row({ deliveryDate: new Date('2026-11-03T00:00:00.000Z') }) as never);
    await expect(service.update(amani, 'b-1', { receiveDate: '2026-11-04' })).rejects.toMatchObject(code('DELIVERY_BEFORE_RECEIVE'));
  });

  it('editing other fields of a booking on a day closed later is still allowed', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(row() as never);
    prisma.ppfClosedDay.findUnique.mockResolvedValue({ date: new Date(), reason: null } as never);
    prisma.ppfBooking.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.update(amani, 'b-1', { note: 'bring the spare key' })).resolves.toBeDefined();
  });

  it('moving onto an occupied day is refused', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(row() as never);
    prisma.ppfBooking.updateMany.mockRejectedValue(duplicate());
    await expect(service.update(amani, 'b-1', { receiveDate: '2026-11-04' })).rejects.toMatchObject(code('PPF_DAY_FULL'));
  });

  it('a cancelled booking cannot be edited or cancelled again', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(row({ status: 'CANCELLED', cancelledAt: new Date() }) as never);
    prisma.ppfBooking.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.update(amani, 'b-1', { car: 'Patrol' })).rejects.toMatchObject(code('BOOKING_CANCELLED'));
    await expect(service.cancel(amani, 'b-1')).rejects.toMatchObject(code('BOOKING_CANCELLED'));
  });

  it('404s for an unknown booking and an empty update', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(null);
    await expect(service.update(amani, 'missing', { car: 'Patrol' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(amani, 'b-1', {})).rejects.toMatchObject(code('NOTHING_TO_UPDATE'));
  });

  it('limits a calendar request to 62 days and a forward range', async () => {
    await expect(service.calendar({ from: '2026-11-01', to: '2027-01-02' })).rejects.toMatchObject(code('BAD_RANGE'));
    await expect(service.calendar({ from: '2026-11-02', to: '2026-11-01' })).rejects.toMatchObject(code('BAD_RANGE'));
  });

  it('builds the calendar from active bookings only, but lists cancelled ones too', async () => {
    prisma.ppfBooking.findMany.mockResolvedValue([row(), row({ id: 'b-2', status: 'CANCELLED', cancelledAt: new Date(), receiveDate: new Date('2026-11-03T00:00:00.000Z') })] as never);
    prisma.ppfClosedDay.findMany.mockResolvedValue([]);
    const cal = await service.calendar({ from: '2026-11-02', to: '2026-11-03' });
    expect(cal.days.map((d) => d.state)).toEqual(['FULL', 'OPEN']);
    expect(cal.bookings).toHaveLength(2);
  });

  it('reopening a day that is not closed is a 404', async () => {
    prisma.ppfClosedDay.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.reopenDay('2026-11-02')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd api && npm test -- ppf.service` → FAIL (`./ppf.service` not found).

- [ ] **Step 3: Views**

Create `api/src/ppf/ppf.view.ts`:

```ts
import { dayStr } from '../common/day';
import type { Prisma } from '../generated/prisma/client';

export const PPF_BOOKING_SELECT = {
  id: true,
  type: true,
  status: true,
  car: true,
  ownerName: true,
  phone: true,
  service: true,
  receiveDate: true,
  deliveryDate: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
  createdBy: { select: { id: true, displayName: true } },
  request: { select: { salesName: true } },
} satisfies Prisma.PpfBookingSelect;

type BookingRow = Prisma.PpfBookingGetPayload<{ select: typeof PPF_BOOKING_SELECT }>;

/** What the dashboard sees. Days are "YYYY-MM-DD" strings. */
export function bookingView(b: BookingRow) {
  return {
    id: b.id,
    type: b.type,
    status: b.status,
    car: b.car,
    ownerName: b.ownerName,
    phone: b.phone,
    service: b.service,
    receiveDate: dayStr(b.receiveDate),
    deliveryDate: b.deliveryDate ? dayStr(b.deliveryDate) : null,
    note: b.note,
    /** the salesperson whose approved request created this light job */
    requestedBy: b.request?.salesName ?? null,
    createdBy: b.createdBy,
    createdAt: b.createdAt,
    cancelledAt: b.cancelledAt,
  };
}

export type PpfBookingView = ReturnType<typeof bookingView>;

/** Audit snapshot: the fields a person can change. */
export function bookingAuditView(b: PpfBookingView) {
  const { id: _id, createdBy: _createdBy, createdAt: _createdAt, requestedBy: _requestedBy, ...rest } = b;
  return rest;
}
```

- [ ] **Step 4: DTOs**

Create `api/src/ppf/dto/ppf.dto.ts`:

```ts
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { BOOKING_NOTE_MAX, BOOKING_SERVICE_MAX, CLOSE_REASON_MAX } from '../../../../shared/validation';
import { NameField, PhoneField, TextField } from '../../common/booking-fields';
import { IsDay } from '../../common/day';
import { PageQueryDto } from '../../common/pagination';
import { EmptyToNull, EmptyToUndefined, Trim } from '../../common/validators';

export const PPF_BOOKING_TYPES = ['FULL', 'LIGHT'] as const;
export const BOOKING_STATUSES = ['BOOKED', 'CANCELLED'] as const;

export class CalendarQueryDto {
  @IsDay()
  from: string;

  @IsDay()
  to: string;
}

export class CreatePpfBookingDto {
  @IsIn(PPF_BOOKING_TYPES)
  type: (typeof PPF_BOOKING_TYPES)[number];

  @NameField()
  car: string;

  @NameField()
  ownerName: string;

  @IsOptional()
  @EmptyToUndefined()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToUndefined()
  @TextField(BOOKING_SERVICE_MAX)
  service?: string | null;

  /** The day the car arrives; a FULL booking closes it. */
  @IsDay()
  receiveDate: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsDay()
  deliveryDate?: string | null;

  @IsOptional()
  @EmptyToUndefined()
  @TextField(BOOKING_NOTE_MAX)
  note?: string | null;
}

/** Every field is optional; send "" or null to clear phone, service, delivery day or note. */
export class UpdatePpfBookingDto {
  @IsOptional()
  @IsIn(PPF_BOOKING_TYPES)
  type?: (typeof PPF_BOOKING_TYPES)[number];

  @IsOptional()
  @NameField()
  car?: string;

  @IsOptional()
  @NameField()
  ownerName?: string;

  @IsOptional()
  @EmptyToNull()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToNull()
  @TextField(BOOKING_SERVICE_MAX)
  service?: string | null;

  @IsOptional()
  @IsDay()
  receiveDate?: string;

  @IsOptional()
  @EmptyToNull()
  @IsDay()
  deliveryDate?: string | null;

  @IsOptional()
  @EmptyToNull()
  @TextField(BOOKING_NOTE_MAX)
  note?: string | null;
}

export class ListPpfBookingsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsDay()
  from?: string;

  @IsOptional()
  @IsDay()
  to?: string;

  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: (typeof BOOKING_STATUSES)[number];

  /** matches car, owner name, phone or service */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class CloseDayDto {
  @IsOptional()
  @EmptyToUndefined()
  @TextField(CLOSE_REASON_MAX)
  reason?: string | null;
}
```

- [ ] **Step 5: The service**

Create `api/src/ppf/ppf.service.ts`:

```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CALENDAR_MAX_DAYS } from '../../../shared/validation';
import { AuditTrail } from '../activity/audit-trail.service';
import { dayStr, daysBetween, qatarToday, toDate } from '../common/day';
import { type Page, skipTake } from '../common/pagination';
import type { AuthUser } from '../common/types';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type DayInfo, dayStates } from './day-state';
import type { CloseDayDto, CreatePpfBookingDto, ListPpfBookingsQueryDto, UpdatePpfBookingDto } from './dto/ppf.dto';
import { bookingAuditView, bookingView, PPF_BOOKING_SELECT, type PpfBookingView } from './ppf.view';

export const conflict = (code: string, message: string) => new ConflictException({ statusCode: 409, error: 'Conflict', code, message });
export const bad = (code: string, message: string) => new BadRequestException({ statusCode: 400, error: 'Bad Request', code, message });

/** ppf_bookings has one unique index besides its primary key: one active full PPF per day. */
const isDayTaken = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
const dayFull = () => conflict('PPF_DAY_FULL', 'A full PPF is already booked on this day.');

type Db = Pick<Prisma.TransactionClient, 'ppfClosedDay'>;

/**
 * PPF and tinting bookings for Bin Omran. A FULL booking closes its receive
 * day (one per day, enforced by the database); LIGHT jobs never do. The call
 * center can also close a day by hand, which blocks new bookings of both kinds.
 */
@Injectable()
export class PpfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trail: AuditTrail,
  ) {}

  async calendar(q: { from: string; to: string }): Promise<{ today: string; days: DayInfo[]; bookings: PpfBookingView[] }> {
    this.assertRange(q.from, q.to);
    const between = { gte: toDate(q.from), lte: toDate(q.to) };
    const [rows, closed] = await Promise.all([
      this.prisma.ppfBooking.findMany({
        where: { receiveDate: between },
        select: PPF_BOOKING_SELECT,
        orderBy: [{ receiveDate: 'asc' }, { type: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.ppfClosedDay.findMany({ where: { date: between }, select: { date: true, reason: true } }),
    ]);
    const bookings = rows.map(bookingView);
    return {
      today: qatarToday(),
      days: dayStates(
        q.from,
        q.to,
        bookings.filter((b) => b.status === 'BOOKED'),
        closed.map((c) => ({ date: dayStr(c.date), reason: c.reason })),
      ),
      bookings,
    };
  }

  async list(q: ListPpfBookingsQueryDto): Promise<Page<PpfBookingView>> {
    const and: Prisma.PpfBookingWhereInput[] = [];
    if (q.from) and.push({ receiveDate: { gte: toDate(q.from) } });
    if (q.to) and.push({ receiveDate: { lte: toDate(q.to) } });
    if (q.status) and.push({ status: q.status });
    if (q.q) {
      const contains = { contains: q.q, mode: 'insensitive' as const };
      and.push({ OR: [{ car: contains }, { ownerName: contains }, { phone: contains }, { service: contains }] });
    }
    const where: Prisma.PpfBookingWhereInput = { AND: and };
    const [rows, total] = await Promise.all([
      this.prisma.ppfBooking.findMany({ where, select: PPF_BOOKING_SELECT, orderBy: [{ receiveDate: 'asc' }, { type: 'asc' }, { createdAt: 'asc' }], ...skipTake(q) }),
      this.prisma.ppfBooking.count({ where }),
    ]);
    return { items: rows.map(bookingView), page: q.page, pageSize: q.pageSize, total };
  }

  async create(user: AuthUser, dto: CreatePpfBookingDto): Promise<PpfBookingView> {
    this.assertDelivery(dto.receiveDate, dto.deliveryDate ?? null);
    await this.assertNotClosed(dto.receiveDate);
    try {
      const row = await this.prisma.ppfBooking.create({
        data: {
          type: dto.type,
          car: dto.car,
          ownerName: dto.ownerName,
          phone: dto.phone ?? null,
          service: dto.service ?? null,
          receiveDate: toDate(dto.receiveDate),
          deliveryDate: dto.deliveryDate ? toDate(dto.deliveryDate) : null,
          note: dto.note ?? null,
          createdById: user.id,
        },
        select: PPF_BOOKING_SELECT,
      });
      const view = bookingView(row);
      this.trail.setEntity('PpfBooking', view.id).setChange(null, bookingAuditView(view));
      return view;
    } catch (err) {
      if (isDayTaken(err)) throw dayFull();
      throw err;
    }
  }

  async update(user: AuthUser, id: string, dto: UpdatePpfBookingDto): Promise<PpfBookingView> {
    if (Object.values(dto).every((v) => v === undefined)) throw bad('NOTHING_TO_UPDATE', 'Nothing to update.');
    const before = await this.get(id);
    if (before.status === 'CANCELLED') throw conflict('BOOKING_CANCELLED', 'A cancelled booking cannot be changed.');

    const receiveDate = dto.receiveDate ?? before.receiveDate;
    const deliveryDate = dto.deliveryDate !== undefined ? dto.deliveryDate : before.deliveryDate;
    this.assertDelivery(receiveDate, deliveryDate);
    // a day closed after the booking was made does not freeze the booking; only moving onto one is refused
    if (receiveDate !== before.receiveDate) await this.assertNotClosed(receiveDate);

    try {
      const result = await this.prisma.ppfBooking.updateMany({
        where: { id, status: 'BOOKED' },
        data: {
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.car !== undefined ? { car: dto.car } : {}),
          ...(dto.ownerName !== undefined ? { ownerName: dto.ownerName } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.service !== undefined ? { service: dto.service } : {}),
          ...(dto.receiveDate !== undefined ? { receiveDate: toDate(dto.receiveDate) } : {}),
          ...(dto.deliveryDate !== undefined ? { deliveryDate: dto.deliveryDate ? toDate(dto.deliveryDate) : null } : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
          updatedById: user.id,
        },
      });
      if (result.count === 0) throw conflict('BOOKING_CANCELLED', 'A cancelled booking cannot be changed.');
    } catch (err) {
      if (isDayTaken(err)) throw dayFull();
      throw err;
    }
    const after = await this.get(id);
    this.trail.setEntity('PpfBooking', id).setChange(bookingAuditView(before), bookingAuditView(after));
    return after;
  }

  /** One conditional UPDATE, so two people cancelling at once cannot both succeed. */
  async cancel(user: AuthUser, id: string): Promise<PpfBookingView> {
    const before = await this.get(id);
    const result = await this.prisma.ppfBooking.updateMany({
      where: { id, status: 'BOOKED' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: user.id },
    });
    if (result.count === 0) throw conflict('BOOKING_CANCELLED', 'This booking is already cancelled.');
    const after = await this.get(id);
    this.trail.setEntity('PpfBooking', id).setChange(bookingAuditView(before), bookingAuditView(after));
    return after;
  }

  async closeDay(user: AuthUser, date: string, dto: CloseDayDto): Promise<{ date: string; reason: string | null }> {
    const reason = dto.reason ?? null;
    await this.prisma.ppfClosedDay.upsert({
      where: { date: toDate(date) },
      create: { date: toDate(date), reason, createdById: user.id },
      update: { reason },
    });
    this.trail.setEntity('PpfClosedDay', date).setChange(null, { date, reason });
    return { date, reason };
  }

  async reopenDay(date: string): Promise<void> {
    const result = await this.prisma.ppfClosedDay.deleteMany({ where: { date: toDate(date) } });
    if (result.count === 0) throw new NotFoundException('This day is not closed.');
    this.trail.setEntity('PpfClosedDay', date).setChange({ date }, null);
  }

  private async get(id: string): Promise<PpfBookingView> {
    const row = await this.prisma.ppfBooking.findUnique({ where: { id }, select: PPF_BOOKING_SELECT });
    if (!row) throw new NotFoundException('Booking not found.');
    return bookingView(row);
  }

  protected assertRange(from: string, to: string): void {
    const span = daysBetween(from, to);
    if (span < 0 || span >= CALENDAR_MAX_DAYS) {
      throw bad('BAD_RANGE', `Choose a range of 1 to ${CALENDAR_MAX_DAYS} days, with "from" on or before "to".`);
    }
  }

  private assertDelivery(receiveDate: string, deliveryDate: string | null): void {
    if (deliveryDate && deliveryDate < receiveDate) {
      throw bad('DELIVERY_BEFORE_RECEIVE', 'The delivery day cannot be before the receive day.');
    }
  }

  protected async assertNotClosed(date: string, db: Db = this.prisma): Promise<void> {
    if (await db.ppfClosedDay.findUnique({ where: { date: toDate(date) } })) {
      throw conflict('PPF_DAY_CLOSED', 'This day is closed. Reopen it first.');
    }
  }
}
```

(`assertRange` and `assertNotClosed` are `protected` only so Task 5 can call them from methods added to this same class; nothing subclasses the service.)

- [ ] **Step 6: Controller, module, registration**

Create `api/src/ppf/ppf.controller.ts`:

```ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ParseDayPipe } from '../common/day';
import type { AuthUser } from '../common/types';
import { CalendarQueryDto, CloseDayDto, CreatePpfBookingDto, ListPpfBookingsQueryDto, UpdatePpfBookingDto } from './dto/ppf.dto';
import { PpfService } from './ppf.service';

/** The call center's PPF calendar (Bin Omran). Reading and managing are separate permissions. */
@ApiTags('ppf')
@ApiBearerAuth()
@Controller('ppf')
export class PpfController {
  constructor(private readonly ppf: PpfService) {}

  @RequirePermissions('booking.ppf.read')
  @Get('calendar')
  calendar(@Query() query: CalendarQueryDto) {
    return this.ppf.calendar(query);
  }

  @RequirePermissions('booking.ppf.read')
  @Get('bookings')
  list(@Query() query: ListPpfBookingsQueryDto) {
    return this.ppf.list(query);
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_booking.create', { entity: 'PpfBooking' })
  @Post('bookings')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePpfBookingDto) {
    return this.ppf.create(user, dto);
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_booking.update', { entity: 'PpfBooking', idParam: 'id' })
  @Patch('bookings/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePpfBookingDto) {
    return this.ppf.update(user, id, dto);
  }

  /** Keeps the booking, marked cancelled, and frees its day. */
  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_booking.cancel', { entity: 'PpfBooking', idParam: 'id' })
  @Post('bookings/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.ppf.cancel(user, id);
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_day.close', { entity: 'PpfClosedDay', idParam: 'date' })
  @Put('closed-days/:date')
  closeDay(@CurrentUser() user: AuthUser, @Param('date', ParseDayPipe) date: string, @Body() dto: CloseDayDto) {
    return this.ppf.closeDay(user, date, dto);
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_day.reopen', { entity: 'PpfClosedDay', idParam: 'date' })
  @Delete('closed-days/:date')
  @HttpCode(204)
  reopenDay(@Param('date', ParseDayPipe) date: string) {
    return this.ppf.reopenDay(date);
  }
}
```

Create `api/src/ppf/ppf.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PpfController } from './ppf.controller';
import { PpfService } from './ppf.service';

@Module({
  controllers: [PpfController],
  providers: [PpfService],
  exports: [PpfService],
})
export class PpfModule {}
```

In `api/src/app.module.ts`, import `PpfModule` from `./ppf/ppf.module` and add it to `imports` after `OrdersModule`.

- [ ] **Step 7: RBAC matrix**

In `api/test/rbac-matrix.e2e-spec.ts` add to `MATRIX` (before `'GET /api/public/products'`):

```ts
  'GET /api/ppf/calendar': ['admin', 'reservations'],
  'GET /api/ppf/bookings': ['admin', 'reservations'],
  'POST /api/ppf/bookings': ['admin', 'reservations'],
  'PATCH /api/ppf/bookings/:id': ['admin', 'reservations'],
  'POST /api/ppf/bookings/:id/cancel': ['admin', 'reservations'],
  'PUT /api/ppf/closed-days/:date': ['admin', 'reservations'],
  'DELETE /api/ppf/closed-days/:date': ['admin', 'reservations'],
```

and teach `fillPath` the new parameter (add before the `:id` replacement):

```ts
    .replace(':date', '2031-01-05')
```

- [ ] **Step 8: Write the e2e test**

Create `api/test/ppf.e2e-spec.ts`:

```ts
import { createTestApp, type TestApp } from './utils/app';
import { bearer, login } from './utils/auth';
import { PW, seedWorld, type World } from './utils/fixtures';

describe('PPF bookings (e2e)', () => {
  let t: TestApp;
  let world: World;
  let amani: string;
  let finance: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    world = await seedWorld(t.prisma);
    amani = (await login(t, 'reservations', PW.reservations)).token;
    finance = (await login(t, 'finance', PW.finance)).token;
  });
  afterAll(async () => {
    await t.close();
  });

  const DAY = '2031-03-10';
  const book = (body: Record<string, unknown> = {}, token = amani) =>
    t
      .http()
      .post('/api/ppf/bookings')
      .set(bearer(token))
      .send({ type: 'FULL', car: 'Land Cruiser 2024', ownerName: 'Khalid Al-Marri', receiveDate: DAY, ...body });
  const calendar = (from = DAY, to = DAY) => t.http().get('/api/ppf/calendar').query({ from, to }).set(bearer(amani));
  const dayOf = async (date = DAY) => (await calendar(date, date)).body.days[0] as { state: string; reason: string | null; lightCount: number };

  it('a full PPF closes its day; light jobs fit in without limit', async () => {
    const first = await book({ phone: '٥٥١٢٣٤٥٦', deliveryDate: '2031-03-13', service: 'Bundle 1', note: 'Black, two keys' });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      type: 'FULL',
      status: 'BOOKED',
      phone: '55123456',
      receiveDate: DAY,
      deliveryDate: '2031-03-13',
      requestedBy: null,
      createdBy: { id: world.reservationsId },
    });

    const second = await book({ car: 'Patrol' });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('PPF_DAY_FULL');

    expect((await book({ type: 'LIGHT', car: 'Lexus LX', service: 'Tint' })).status).toBe(201);
    expect((await book({ type: 'LIGHT', car: 'Tesla Y', service: 'Tint' })).status).toBe(201);
    expect(await dayOf()).toEqual({ date: DAY, state: 'FULL', reason: null, lightCount: 2 });
    // the delivery day is information only
    expect((await dayOf('2031-03-13')).state).toBe('OPEN');
  });

  it('cancelling frees the day and keeps the booking in the list', async () => {
    const { body: first } = await book();
    const cancelled = await t.http().post(`/api/ppf/bookings/${first.id}/cancel`).set(bearer(amani));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect((await dayOf()).state).toBe('OPEN');
    expect((await book({ car: 'Patrol' })).status).toBe(201);

    const cal = await calendar();
    expect(cal.body.bookings.map((b: { status: string }) => b.status).sort()).toEqual(['BOOKED', 'CANCELLED']);

    const again = await t.http().post(`/api/ppf/bookings/${first.id}/cancel`).set(bearer(amani));
    expect(again.body.code).toBe('BOOKING_CANCELLED');
    const edit = await t.http().patch(`/api/ppf/bookings/${first.id}`).set(bearer(amani)).send({ car: 'Other' });
    expect(edit.body.code).toBe('BOOKING_CANCELLED');
  });

  it('moving a full PPF onto an occupied day is refused; onto a free day it works', async () => {
    await book();
    const { body: other } = await book({ receiveDate: '2031-03-11', car: 'Patrol' });
    const clash = await t.http().patch(`/api/ppf/bookings/${other.id}`).set(bearer(amani)).send({ receiveDate: DAY });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('PPF_DAY_FULL');

    const moved = await t.http().patch(`/api/ppf/bookings/${other.id}`).set(bearer(amani)).send({ receiveDate: '2031-03-12', phone: '' });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ receiveDate: '2031-03-12', phone: null });
    expect((await dayOf('2031-03-11')).state).toBe('OPEN');
    expect((await dayOf('2031-03-12')).state).toBe('FULL');
  });

  it('turning a light job into a full PPF obeys the same rule', async () => {
    await book();
    const { body: light } = await book({ type: 'LIGHT', car: 'Lexus LX' });
    const res = await t.http().patch(`/api/ppf/bookings/${light.id}`).set(bearer(amani)).send({ type: 'FULL' });
    expect(res.body.code).toBe('PPF_DAY_FULL');
  });

  it('two bookings for the same day at once: one wins', async () => {
    const [a, b] = await Promise.all([book({ car: 'A-car' }), book({ car: 'B-car' })]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it('a day closed by hand takes no bookings until it is reopened', async () => {
    const closed = await t.http().put(`/api/ppf/closed-days/${DAY}`).set(bearer(amani)).send({ reason: 'National Day' });
    expect(closed.status).toBe(200);
    expect(await dayOf()).toEqual({ date: DAY, state: 'CLOSED', reason: 'National Day', lightCount: 0 });
    for (const type of ['FULL', 'LIGHT']) expect((await book({ type })).body.code).toBe('PPF_DAY_CLOSED');

    expect((await t.http().delete(`/api/ppf/closed-days/${DAY}`).set(bearer(amani))).status).toBe(204);
    expect((await t.http().delete(`/api/ppf/closed-days/${DAY}`).set(bearer(amani))).status).toBe(404);
    expect((await book()).status).toBe(201);
  });

  it('rejects impossible days, bad ranges and unknown fields', async () => {
    const impossible = await book({ receiveDate: '2031-02-30' });
    expect(impossible.status).toBe(400);
    expect(impossible.body.code).toBe('VALIDATION_FAILED');
    expect((await book({ deliveryDate: '2031-03-09' })).body.code).toBe('DELIVERY_BEFORE_RECEIVE');
    expect((await book({ branchId: world.bo.id })).status).toBe(400);
    expect((await calendar('2031-03-01', '2031-06-01')).body.code).toBe('BAD_RANGE');
    expect((await t.http().put('/api/ppf/closed-days/2031-02-30').set(bearer(amani)).send({})).status).toBe(400);
  });

  it('view-only access can read the calendar but change nothing', async () => {
    await t.prisma.userPermissionOverride.create({ data: { userId: world.financeId, permissionKey: 'booking.ppf.read', effect: 'GRANT' } });
    expect((await t.http().get('/api/ppf/calendar').query({ from: DAY, to: DAY }).set(bearer(finance))).status).toBe(200);
    expect((await book({}, finance)).status).toBe(403);
  });

  it('writes each change to the activity log', async () => {
    const { body } = await book();
    await t.http().post(`/api/ppf/bookings/${body.id}/cancel`).set(bearer(amani));
    const log = await t.prisma.activityLog.findMany({ where: { entityType: 'PpfBooking', entityId: body.id }, orderBy: { id: 'asc' } });
    expect(log.map((l) => [l.action, l.outcome, l.actorUsername])).toEqual([
      ['ppf_booking.create', 'SUCCESS', 'reservations'],
      ['ppf_booking.cancel', 'SUCCESS', 'reservations'],
    ]);
  });
});
```

- [ ] **Step 9: Run everything**

```bash
cd api && npm run typecheck && npm run lint && npm test -- ppf && npm run test:e2e -- ppf rbac-matrix audit-coverage
```

Expected: PASS. If the phone test stores `٥٥١٢٣٤٥٦` unchanged, the transform order in `PhoneField` is wrong — the normalising `Transform` must be the field's own (lowest) transform.

- [ ] **Step 10: Commit**

```bash
git add api/src/ppf api/src/app.module.ts api/test
git commit -m "feat(api): PPF bookings, closed days and the calendar"
```

---

### Task 5: Light-job requests and the sales view (API, service side)

**Files:**
- Modify: `api/src/ppf/ppf.view.ts`, `api/src/ppf/dto/ppf.dto.ts`, `api/src/ppf/ppf.service.ts`, `api/src/ppf/ppf.controller.ts`
- Create: `api/src/ppf/ppf-requests.service.spec.ts`
- Modify: `api/test/ppf.e2e-spec.ts`, `api/test/rbac-matrix.e2e-spec.ts`

**Interfaces:**
- Consumes: everything Task 4 produced.
- Produces:
  - `LightJobRequestView = { id: string; date: string; salesName: string; car: string; ownerName: string; phone: string | null; note: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; decisionNote: string | null; decidedAt: Date | null; bookingId: string | null; createdAt: Date }`
  - `PpfService.listRequests(q: ListRequestsQueryDto): Promise<Page<LightJobRequestView>>`
  - `PpfService.approveRequest(user: AuthUser, id: string, dto: DecideRequestDto): Promise<LightJobRequestView>`
  - `PpfService.rejectRequest(user: AuthUser, id: string, dto: DecideRequestDto): Promise<LightJobRequestView>`
  - `PpfService.createRequest(dto: CreateLightJobRequestDto, now?: Date): Promise<SalesRequestView>` — used by Task 6
  - `PpfService.salesView(q: { from: string; to: string }, now?: Date): Promise<{ today: string; days: DayInfo[]; bookings: SalesBookingView[]; requests: SalesRequestView[] }>` — used by Task 6
  - `SalesBookingView = { id: string; type: 'FULL' | 'LIGHT'; car: string; ownerName: string; phone: string | null; receiveDate: string; deliveryDate: string | null }`
  - `SalesRequestView = { id: string; date: string; salesName: string; car: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; decisionNote: string | null; createdAt: Date }`
  - `CreateLightJobRequestDto { date; salesName; car; ownerName; phone?; note }`, `DecideRequestDto { decisionNote? }`
  - Routes: `GET /api/ppf/requests`, `POST /api/ppf/requests/:id/approve`, `POST /api/ppf/requests/:id/reject`
  - Audit actions: `ppf_request.approve`, `ppf_request.reject`

- [ ] **Step 1: Write the failing unit test**

Create `api/src/ppf/ppf-requests.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PrismaService } from '../prisma/prisma.service';
import { PpfService } from './ppf.service';

const request = (over: Record<string, unknown> = {}) => ({
  id: 'r-1',
  date: new Date('2026-11-02T00:00:00.000Z'),
  salesName: 'Yousef',
  car: 'Lexus LX',
  ownerName: 'Sara',
  phone: null,
  note: 'Front windows tint',
  status: 'PENDING',
  decisionNote: null,
  decidedAt: null,
  bookingId: null,
  createdAt: new Date('2026-11-01T08:00:00.000Z'),
  ...over,
});
const code = (c: string) => ({ response: { code: c } });
// 21:30 UTC on 1 Nov is already 2 Nov in Qatar
const NIGHT = new Date('2026-11-01T21:30:00.000Z');

describe('PpfService: light-job requests', () => {
  const prisma = mockDeep<PrismaService>();
  const trail = mock<AuditTrail>();
  const service = new PpfService(prisma, trail);
  const amani = authUser({ id: 'u-1', role: 'RESERVATIONS', branchId: null }, ['booking.ppf.manage']);
  const dto = { date: '2026-11-02', salesName: 'Yousef', car: 'Lexus LX', ownerName: 'Sara', note: 'Front windows tint' };

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'setBranch', 'addMetadata'] as const) trail[m].mockReturnValue(trail);
    prisma.$transaction.mockImplementation((arg: unknown) =>
      (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[])) as never,
    );
    prisma.ppfClosedDay.findUnique.mockResolvedValue(null);
  });

  describe('createRequest', () => {
    it('accepts a request for a day closed by a full PPF', async () => {
      prisma.ppfBooking.count.mockResolvedValue(1);
      prisma.lightJobRequest.create.mockResolvedValue(request() as never);
      const view = await service.createRequest(dto, NIGHT);
      expect(prisma.ppfBooking.count).toHaveBeenCalledWith({
        where: { receiveDate: new Date('2026-11-02T00:00:00.000Z'), type: 'FULL', status: 'BOOKED' },
      });
      expect(view).toEqual({
        id: 'r-1',
        date: '2026-11-02',
        salesName: 'Yousef',
        car: 'Lexus LX',
        status: 'PENDING',
        decisionNote: null,
        createdAt: new Date('2026-11-01T08:00:00.000Z'),
      });
      expect(trail.addMetadata).toHaveBeenCalledWith({ salesName: 'Yousef' });
    });

    it('refuses a day that is already past in Qatar', async () => {
      await expect(service.createRequest({ ...dto, date: '2026-11-01' }, NIGHT)).rejects.toMatchObject(code('REQUEST_DAY_PAST'));
    });

    it('refuses an open day and a day closed by hand', async () => {
      prisma.ppfBooking.count.mockResolvedValue(0);
      await expect(service.createRequest(dto, NIGHT)).rejects.toMatchObject(code('PPF_DAY_NOT_FULL'));
      prisma.ppfBooking.count.mockResolvedValue(1);
      prisma.ppfClosedDay.findUnique.mockResolvedValue({ date: new Date(), reason: null } as never);
      await expect(service.createRequest(dto, NIGHT)).rejects.toMatchObject(code('PPF_DAY_NOT_FULL'));
    });
  });

  describe('approve / reject', () => {
    it('approving creates the light job from the request and links it', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.lightJobRequest.findUniqueOrThrow.mockResolvedValue(request({ status: 'APPROVED', phone: '55123456' }) as never);
      prisma.ppfBooking.create.mockResolvedValue({ id: 'b-9' } as never);
      prisma.lightJobRequest.update.mockResolvedValue(request({ status: 'APPROVED', bookingId: 'b-9' }) as never);

      const view = await service.approveRequest(amani, 'r-1', {});
      expect(prisma.lightJobRequest.updateMany.mock.calls[0][0].where).toEqual({ id: 'r-1', status: 'PENDING' });
      expect(prisma.ppfBooking.create.mock.calls[0][0].data).toEqual({
        type: 'LIGHT',
        car: 'Lexus LX',
        ownerName: 'Sara',
        phone: '55123456',
        note: 'Front windows tint',
        receiveDate: new Date('2026-11-02T00:00:00.000Z'),
        createdById: 'u-1',
      });
      expect(view).toMatchObject({ status: 'APPROVED', bookingId: 'b-9' });
    });

    it('a request is decided once', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.lightJobRequest.findUnique.mockResolvedValue(request({ status: 'REJECTED' }) as never);
      await expect(service.approveRequest(amani, 'r-1', {})).rejects.toMatchObject(code('REQUEST_ALREADY_DECIDED'));
      await expect(service.rejectRequest(amani, 'r-1', {})).rejects.toMatchObject(code('REQUEST_ALREADY_DECIDED'));
      expect(prisma.ppfBooking.create).not.toHaveBeenCalled();
    });

    it('an unknown request is a 404', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.lightJobRequest.findUnique.mockResolvedValue(null);
      await expect(service.rejectRequest(amani, 'nope', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('approval fails when the day was closed by hand in the meantime', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.lightJobRequest.findUniqueOrThrow.mockResolvedValue(request({ status: 'APPROVED' }) as never);
      prisma.ppfClosedDay.findUnique.mockResolvedValue({ date: new Date(), reason: null } as never);
      await expect(service.approveRequest(amani, 'r-1', {})).rejects.toMatchObject(code('PPF_DAY_CLOSED'));
      expect(prisma.ppfBooking.create).not.toHaveBeenCalled();
    });

    it('rejecting stores the reason and creates nothing', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.lightJobRequest.findUniqueOrThrow.mockResolvedValue(request({ status: 'REJECTED', decisionNote: 'Workshop is full' }) as never);
      const view = await service.rejectRequest(amani, 'r-1', { decisionNote: 'Workshop is full' });
      expect(prisma.lightJobRequest.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'REJECTED', decisionNote: 'Workshop is full', decidedById: 'u-1' });
      expect(view.decisionNote).toBe('Workshop is full');
      expect(prisma.ppfBooking.create).not.toHaveBeenCalled();
    });
  });

  describe('salesView', () => {
    it('only serves the current month onwards, about a year ahead', async () => {
      await expect(service.salesView({ from: '2026-10-31', to: '2026-11-30' }, NIGHT)).rejects.toMatchObject(code('BAD_RANGE'));
      await expect(service.salesView({ from: '2027-12-10', to: '2027-12-31' }, NIGHT)).rejects.toMatchObject(code('BAD_RANGE'));
    });

    it('returns days, upcoming cars and recent requests without internal fields', async () => {
      prisma.ppfBooking.findMany
        .mockResolvedValueOnce([{ type: 'FULL', receiveDate: new Date('2026-11-02T00:00:00.000Z') }] as never) // days
        .mockResolvedValueOnce([
          { id: 'b-1', type: 'FULL', car: 'Land Cruiser', ownerName: 'Khalid', phone: null, receiveDate: new Date('2026-11-02T00:00:00.000Z'), deliveryDate: null },
        ] as never); // upcoming
      prisma.ppfClosedDay.findMany.mockResolvedValue([]);
      prisma.lightJobRequest.findMany.mockResolvedValue([request()] as never);

      const view = await service.salesView({ from: '2026-11-01', to: '2026-11-30' }, NIGHT);
      expect(view.today).toBe('2026-11-02');
      expect(view.days).toHaveLength(30);
      expect(view.days[1]).toMatchObject({ date: '2026-11-02', state: 'FULL' });
      expect(view.bookings).toEqual([
        { id: 'b-1', type: 'FULL', car: 'Land Cruiser', ownerName: 'Khalid', phone: null, receiveDate: '2026-11-02', deliveryDate: null },
      ]);
      expect(Object.keys(view.requests[0]).sort()).toEqual(['car', 'createdAt', 'date', 'decisionNote', 'id', 'salesName', 'status']);
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd api && npm test -- ppf-requests` → FAIL (`service.createRequest is not a function`).

- [ ] **Step 3: Views**

Append to `api/src/ppf/ppf.view.ts`:

```ts
export const REQUEST_SELECT = {
  id: true,
  date: true,
  salesName: true,
  car: true,
  ownerName: true,
  phone: true,
  note: true,
  status: true,
  decisionNote: true,
  decidedAt: true,
  bookingId: true,
  createdAt: true,
} satisfies Prisma.LightJobRequestSelect;

type RequestRow = Prisma.LightJobRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

/** What the call center sees. */
export function requestView(r: RequestRow) {
  return { ...r, date: dayStr(r.date) };
}
export type LightJobRequestView = ReturnType<typeof requestView>;

/** What the sales page sees: no customer details beyond the car, no note. */
export function salesRequestView(r: Pick<RequestRow, 'id' | 'date' | 'salesName' | 'car' | 'status' | 'decisionNote' | 'createdAt'>) {
  return { id: r.id, date: dayStr(r.date), salesName: r.salesName, car: r.car, status: r.status, decisionNote: r.decisionNote, createdAt: r.createdAt };
}
export type SalesRequestView = ReturnType<typeof salesRequestView>;

export const SALES_BOOKING_SELECT = {
  id: true,
  type: true,
  car: true,
  ownerName: true,
  phone: true,
  receiveDate: true,
  deliveryDate: true,
} satisfies Prisma.PpfBookingSelect;

type SalesBookingRow = Prisma.PpfBookingGetPayload<{ select: typeof SALES_BOOKING_SELECT }>;

/** The sales page's list of booked cars: exactly the fields the spec names. */
export function salesBookingView(b: SalesBookingRow) {
  return {
    id: b.id,
    type: b.type,
    car: b.car,
    ownerName: b.ownerName,
    phone: b.phone,
    receiveDate: dayStr(b.receiveDate),
    deliveryDate: b.deliveryDate ? dayStr(b.deliveryDate) : null,
  };
}
export type SalesBookingView = ReturnType<typeof salesBookingView>;
```

- [ ] **Step 4: DTOs**

Append to `api/src/ppf/dto/ppf.dto.ts` (add `DECISION_NOTE_MAX` to the import from `shared/validation`):

```ts
export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export class ListRequestsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(REQUEST_STATUSES)
  status?: (typeof REQUEST_STATUSES)[number];
}

export class DecideRequestDto {
  /** Shown to sales, e.g. why the request was rejected. */
  @IsOptional()
  @EmptyToUndefined()
  @TextField(DECISION_NOTE_MAX)
  decisionNote?: string | null;
}

/** Sent from the sales page; sales have no accounts, so the name is typed. */
export class CreateLightJobRequestDto {
  @IsDay()
  date: string;

  @NameField()
  salesName: string;

  @NameField()
  car: string;

  @NameField()
  ownerName: string;

  @IsOptional()
  @EmptyToUndefined()
  @PhoneField()
  phone?: string | null;

  /** What the light job is. */
  @TextField(BOOKING_NOTE_MAX)
  note: string;
}
```

- [ ] **Step 5: Service methods**

In `api/src/ppf/ppf.service.ts`:

Add to the imports: `addDays` (from `../common/day`), the three new DTO types, and from `./ppf.view`: `type LightJobRequestView`, `REQUEST_SELECT`, `requestView`, `SALES_BOOKING_SELECT`, `type SalesBookingView`, `salesBookingView`, `type SalesRequestView`, `salesRequestView`.

Add these constants below `dayFull`:

```ts
const alreadyDecided = () => conflict('REQUEST_ALREADY_DECIDED', 'This request has already been answered.');
/** How far ahead the sales page may look, and how long a request stays listed. */
const SALES_HORIZON_DAYS = 400;
const REQUEST_LISTED_MS = 14 * 86_400_000;
```

Add these methods to the class, after `reopenDay`:

```ts
  async listRequests(q: ListRequestsQueryDto): Promise<Page<LightJobRequestView>> {
    const where: Prisma.LightJobRequestWhereInput = q.status ? { status: q.status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.lightJobRequest.findMany({ where, select: REQUEST_SELECT, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.lightJobRequest.count({ where }),
    ]);
    return { items: rows.map(requestView), page: q.page, pageSize: q.pageSize, total };
  }

  /**
   * Claims the request (PENDING → APPROVED) and adds the light job in one
   * transaction: a second approval, or an approval racing a rejection, finds
   * nothing to claim. A day closed by hand since then rolls everything back.
   */
  async approveRequest(user: AuthUser, id: string, dto: DecideRequestDto): Promise<LightJobRequestView> {
    const view = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.lightJobRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED', decidedById: user.id, decidedAt: new Date(), decisionNote: dto.decisionNote ?? null },
      });
      if (claimed.count === 0) await this.throwDecided(id, tx);
      const request = await tx.lightJobRequest.findUniqueOrThrow({ where: { id }, select: REQUEST_SELECT });
      await this.assertNotClosed(dayStr(request.date), tx);
      const booking = await tx.ppfBooking.create({
        data: {
          type: 'LIGHT',
          car: request.car,
          ownerName: request.ownerName,
          phone: request.phone,
          note: request.note,
          receiveDate: request.date,
          createdById: user.id,
        },
        select: { id: true },
      });
      return requestView(await tx.lightJobRequest.update({ where: { id }, data: { bookingId: booking.id }, select: REQUEST_SELECT }));
    });
    this.trail.setEntity('LightJobRequest', id).setChange({ status: 'PENDING' }, { status: 'APPROVED', bookingId: view.bookingId });
    return view;
  }

  async rejectRequest(user: AuthUser, id: string, dto: DecideRequestDto): Promise<LightJobRequestView> {
    const decisionNote = dto.decisionNote ?? null;
    const claimed = await this.prisma.lightJobRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', decidedById: user.id, decidedAt: new Date(), decisionNote },
    });
    if (claimed.count === 0) await this.throwDecided(id, this.prisma);
    this.trail.setEntity('LightJobRequest', id).setChange({ status: 'PENDING' }, { status: 'REJECTED', decisionNote });
    return requestView(await this.prisma.lightJobRequest.findUniqueOrThrow({ where: { id }, select: REQUEST_SELECT }));
  }

  /**
   * A salesperson asks for a light job. Only for today or later (Qatar), and
   * only on a day that a full PPF closed — open days are booked through the
   * call center, and days closed by hand take nothing.
   */
  async createRequest(dto: CreateLightJobRequestDto, now: Date = new Date()): Promise<SalesRequestView> {
    if (dto.date < qatarToday(now)) throw bad('REQUEST_DAY_PAST', 'This day has already passed.');
    const date = toDate(dto.date);
    const [full, closed] = await Promise.all([
      this.prisma.ppfBooking.count({ where: { receiveDate: date, type: 'FULL', status: 'BOOKED' } }),
      this.prisma.ppfClosedDay.findUnique({ where: { date } }),
    ]);
    if (closed || full === 0) throw conflict('PPF_DAY_NOT_FULL', 'A light-job request is only for a day closed by a full PPF.');
    const row = await this.prisma.lightJobRequest.create({
      data: { date, salesName: dto.salesName, car: dto.car, ownerName: dto.ownerName, phone: dto.phone ?? null, note: dto.note },
      select: REQUEST_SELECT,
    });
    // sales have no account: the typed name is the only "who"
    this.trail.setEntity('LightJobRequest', row.id).addMetadata({ salesName: dto.salesName });
    return salesRequestView(row);
  }

  /** Everything the sales page shows, and nothing else. */
  async salesView(
    q: { from: string; to: string },
    now: Date = new Date(),
  ): Promise<{ today: string; days: DayInfo[]; bookings: SalesBookingView[]; requests: SalesRequestView[] }> {
    const today = qatarToday(now);
    this.assertRange(q.from, q.to);
    if (q.from < `${today.slice(0, 7)}-01` || q.to > addDays(today, SALES_HORIZON_DAYS)) {
      throw bad('BAD_RANGE', 'The slots page shows the current month and about a year ahead.');
    }
    const between = { gte: toDate(q.from), lte: toDate(q.to) };
    const from = toDate(today);
    const [inRange, upcoming, closed, requests] = await Promise.all([
      this.prisma.ppfBooking.findMany({ where: { status: 'BOOKED', receiveDate: between }, select: { type: true, receiveDate: true } }),
      this.prisma.ppfBooking.findMany({
        where: { status: 'BOOKED', OR: [{ receiveDate: { gte: from } }, { deliveryDate: { gte: from } }] },
        select: SALES_BOOKING_SELECT,
        orderBy: [{ receiveDate: 'asc' }, { type: 'asc' }, { createdAt: 'asc' }],
        take: 200,
      }),
      this.prisma.ppfClosedDay.findMany({ where: { date: between }, select: { date: true, reason: true } }),
      this.prisma.lightJobRequest.findMany({
        where: { OR: [{ createdAt: { gte: new Date(now.getTime() - REQUEST_LISTED_MS) } }, { date: { gte: from } }] },
        select: REQUEST_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return {
      today,
      days: dayStates(
        q.from,
        q.to,
        inRange.map((b) => ({ type: b.type, receiveDate: dayStr(b.receiveDate) })),
        closed.map((c) => ({ date: dayStr(c.date), reason: c.reason })),
      ),
      bookings: upcoming.map(salesBookingView),
      requests: requests.map(salesRequestView),
    };
  }

  private async throwDecided(id: string, db: Pick<Prisma.TransactionClient, 'lightJobRequest'>): Promise<never> {
    const exists = await db.lightJobRequest.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Request not found.');
    throw alreadyDecided();
  }
```

`assertNotClosed`'s `Db` type must accept the transaction client: it already does (`Pick<Prisma.TransactionClient, 'ppfClosedDay'>`).

- [ ] **Step 6: Routes**

Add to `api/src/ppf/ppf.controller.ts` (import `DecideRequestDto`, `ListRequestsQueryDto`), after `reopenDay`:

```ts
  @RequirePermissions('booking.ppf.read')
  @Get('requests')
  requests(@Query() query: ListRequestsQueryDto) {
    return this.ppf.listRequests(query);
  }

  /** Adds the light job to the requested day. */
  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_request.approve', { entity: 'LightJobRequest', idParam: 'id' })
  @Post('requests/:id/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideRequestDto) {
    return this.ppf.approveRequest(user, id, dto);
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('ppf_request.reject', { entity: 'LightJobRequest', idParam: 'id' })
  @Post('requests/:id/reject')
  @HttpCode(200)
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideRequestDto) {
    return this.ppf.rejectRequest(user, id, dto);
  }
```

Add to `MATRIX` in `api/test/rbac-matrix.e2e-spec.ts`:

```ts
  'GET /api/ppf/requests': ['admin', 'reservations'],
  'POST /api/ppf/requests/:id/approve': ['admin', 'reservations'],
  'POST /api/ppf/requests/:id/reject': ['admin', 'reservations'],
```

- [ ] **Step 7: e2e**

Append inside the `describe` of `api/test/ppf.e2e-spec.ts`:

```ts
  describe('light-job requests', () => {
    const pending = () =>
      t.prisma.lightJobRequest.create({
        data: { date: new Date(`${DAY}T00:00:00.000Z`), salesName: 'Yousef', car: 'Lexus LX', ownerName: 'Sara Al-Kuwari', phone: '55123456', note: 'Front windows tint' },
      });

    it('approving adds the light job to the day and names the salesperson on it', async () => {
      await book();
      const req = await pending();
      const list = await t.http().get('/api/ppf/requests').query({ status: 'PENDING' }).set(bearer(amani));
      expect(list.body.total).toBe(1);
      expect(list.body.items[0]).toMatchObject({ id: req.id, date: DAY, note: 'Front windows tint', phone: '55123456' });

      const res = await t.http().post(`/api/ppf/requests/${req.id}/approve`).set(bearer(amani)).send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('APPROVED');
      const cal = await calendar();
      const light = cal.body.bookings.find((b: { id: string }) => b.id === res.body.bookingId);
      expect(light).toMatchObject({ type: 'LIGHT', car: 'Lexus LX', ownerName: 'Sara Al-Kuwari', receiveDate: DAY, requestedBy: 'Yousef' });
      expect(cal.body.days[0]).toMatchObject({ state: 'FULL', lightCount: 1 });
    });

    it('two answers at once: exactly one is accepted and at most one light job exists', async () => {
      await book();
      const req = await pending();
      const [a, b] = await Promise.all([
        t.http().post(`/api/ppf/requests/${req.id}/approve`).set(bearer(amani)).send({}),
        t.http().post(`/api/ppf/requests/${req.id}/reject`).set(bearer(amani)).send({ decisionNote: 'Full' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const lights = await t.prisma.ppfBooking.count({ where: { type: 'LIGHT' } });
      expect(lights).toBe(a.status === 200 ? 1 : 0);
    });

    it('approval is rolled back when the day was closed by hand', async () => {
      await book();
      const req = await pending();
      await t.http().put(`/api/ppf/closed-days/${DAY}`).set(bearer(amani)).send({});
      const res = await t.http().post(`/api/ppf/requests/${req.id}/approve`).set(bearer(amani)).send({});
      expect(res.body.code).toBe('PPF_DAY_CLOSED');
      expect((await t.prisma.lightJobRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe('PENDING');
    });
  });
```

- [ ] **Step 8: Run everything**

```bash
cd api && npm run typecheck && npm run lint && npm test -- ppf && npm run test:e2e -- ppf rbac-matrix audit-coverage
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add api/src/ppf api/test
git commit -m "feat(api): light-job requests and the sales view"
```

---

### Task 6: Sales access — PIN, cookie, guard and `/api/slots`

**Files:**
- Modify: `api/src/auth/token.service.ts`, `api/src/auth/token.service.spec.ts`, `api/src/auth/cookies.ts`
- Create: `api/src/sales-access/dto/sales-access.dto.ts`, `sales-access.service.ts`, `sales-access.service.spec.ts`, `sales-access.guard.ts`, `sales-access.controller.ts`, `slots.controller.ts`, `sales-access.module.ts`
- Create: `api/test/slots.e2e-spec.ts`
- Modify: `api/src/app.module.ts`, `api/test/rbac-matrix.e2e-spec.ts`

**Interfaces:**
- Consumes: `PpfService.salesView`, `PpfService.createRequest`, `CalendarQueryDto`, `CreateLightJobRequestDto` (Tasks 4–5); `PasswordService`, `TokenService`, `AuditTrail`; `hasCsrfHeader` (`auth/cookies.ts`); `SALES_PIN_PATTERN`.
- Produces:
  - `TokenService.signSlots(version: number): Promise<{ token: string; expiresAt: Date }>`, `TokenService.verifySlots(token: string): Promise<number | null>` (the PIN version, or null for any invalid token)
  - `setSlotsCookie(res, token, expires, secure)`, `readSlotsCookie(req): string | undefined` in `auth/cookies.ts`; cookie names `wc_slt` (path `/api/slots`) and hint `wc_slots` (path `/`)
  - `SalesAccessService.status(): Promise<{ pinSet: boolean; updatedAt: Date | null }>`, `.setPin(user: AuthUser, pin: string)` (same return), `.unlock(pin: string): Promise<{ token: string; expiresAt: Date }>`, `.verify(token: string | undefined): Promise<void>` (throws `401 SALES_ACCESS_REQUIRED`)
  - Routes: `GET /api/ppf/sales-access` → `{ pinSet, updatedAt }`; `PUT /api/ppf/sales-access/pin` body `{ pin }`; `POST /api/slots/unlock` body `{ pin }` → `{ expiresAt }` + cookies; `GET /api/slots?from&to`; `POST /api/slots/requests`
  - Audit actions: `sales_access.pin_change`, `sales_access.unlock`, `ppf_request.create`

- [ ] **Step 1: Write the failing unit tests**

Append to `api/src/auth/token.service.spec.ts`, inside its top-level `describe` (reuse that file's existing way of building a `TokenService` with a real `JwtService`; if it only has a mocked `JwtService`, build a real one in this block with `new JwtService({ secret: 'x'.repeat(32), signOptions: { issuer: JWT_ISSUER, algorithm: 'HS256' }, verifyOptions: { issuer: JWT_ISSUER, algorithms: ['HS256'] } })` and pass mocks for the other three constructor arguments):

```ts
  describe('sales slots token', () => {
    it('carries the PIN version and lasts 90 days', async () => {
      const before = Date.now();
      const { token, expiresAt } = await service.signSlots(7);
      expect(await service.verifySlots(token)).toBe(7);
      expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(90 * 86_400_000 - 1000);
    });

    it('is not an access token, and an access token is not a slots token', async () => {
      const { token } = await service.signSlots(1);
      await expect(service.verifyAccess(token)).rejects.toThrow();
      const { accessToken } = await service.signAccess({ id: 'u-1', role: 'SUPER_ADMIN', branchId: null }, 's-1', 'DASHBOARD');
      expect(await service.verifySlots(accessToken)).toBeNull();
      expect(await service.verifySlots('not-a-token')).toBeNull();
    });
  });
```

Create `api/src/sales-access/sales-access.service.spec.ts`:

```ts
import type { ConfigService } from '@nestjs/config';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PasswordService } from '../auth/password.service';
import type { TokenService } from '../auth/token.service';
import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { SalesAccessService } from './sales-access.service';

const access = (over: Record<string, unknown> = {}) => ({
  id: 1,
  pinHash: 'hash',
  version: 3,
  failedCount: 0,
  lockedUntil: null,
  updatedById: 'u-1',
  updatedAt: new Date('2026-11-01T08:00:00.000Z'),
  ...over,
});
const code = (c: string) => ({ response: { code: c } });

describe('SalesAccessService', () => {
  const prisma = mockDeep<PrismaService>();
  const passwords = mock<PasswordService>();
  const tokens = mock<TokenService>();
  const trail = mock<AuditTrail>();
  const config = { get: (key: string) => ({ LOGIN_MAX_ATTEMPTS: 5, LOGIN_LOCK_MINUTES: 15 })[key] } as unknown as ConfigService<Env, true>;
  const service = new SalesAccessService(prisma, passwords, tokens, config, trail);
  const amani = authUser({ id: 'u-1', role: 'RESERVATIONS', branchId: null });

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'addMetadata'] as const) trail[m].mockReturnValue(trail);
    prisma.salesAccess.upsert.mockResolvedValue(access() as never);
  });

  it('reports whether a PIN exists without exposing anything else', async () => {
    expect(await service.status()).toEqual({ pinSet: true, updatedAt: new Date('2026-11-01T08:00:00.000Z') });
    prisma.salesAccess.upsert.mockResolvedValue(access({ pinHash: null }) as never);
    expect(await service.status()).toEqual({ pinSet: false, updatedAt: null });
  });

  it('setting a PIN stores only its hash, bumps the version and clears the lock', async () => {
    passwords.hash.mockResolvedValue('new-hash');
    await service.setPin(amani, '123456');
    const call = prisma.salesAccess.upsert.mock.calls[0][0];
    expect(call.update).toEqual({ pinHash: 'new-hash', version: { increment: 1 }, failedCount: 0, lockedUntil: null, updatedById: 'u-1' });
    expect(JSON.stringify([call, trail.setChange.mock.calls, trail.addMetadata.mock.calls])).not.toContain('123456');
  });

  it('the right PIN yields a token for the current version', async () => {
    passwords.verify.mockResolvedValue(true);
    tokens.signSlots.mockResolvedValue({ token: 't', expiresAt: new Date() });
    await service.unlock('123456');
    expect(tokens.signSlots).toHaveBeenCalledWith(3);
    expect(prisma.salesAccess.update).not.toHaveBeenCalled();
  });

  it('a right PIN after failures resets the counter', async () => {
    prisma.salesAccess.upsert.mockResolvedValue(access({ failedCount: 2 }) as never);
    passwords.verify.mockResolvedValue(true);
    tokens.signSlots.mockResolvedValue({ token: 't', expiresAt: new Date() });
    await service.unlock('123456');
    expect(prisma.salesAccess.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { failedCount: 0, lockedUntil: null } });
  });

  it('a wrong PIN is counted; the fifth one locks unlocking for 15 minutes', async () => {
    passwords.verify.mockResolvedValue(false);
    prisma.salesAccess.update.mockResolvedValueOnce({ failedCount: 4 } as never);
    await expect(service.unlock('000000')).rejects.toMatchObject(code('SALES_PIN_INVALID'));
    expect(prisma.salesAccess.update).toHaveBeenCalledTimes(1);

    prisma.salesAccess.update.mockResolvedValueOnce({ failedCount: 5 } as never);
    const before = Date.now();
    await expect(service.unlock('000000')).rejects.toMatchObject(code('SALES_PIN_INVALID'));
    const lock = prisma.salesAccess.update.mock.calls.at(-1)?.[0].data as { failedCount: number; lockedUntil: Date };
    expect(lock.failedCount).toBe(0);
    expect(lock.lockedUntil.getTime() - before).toBeGreaterThanOrEqual(15 * 60_000 - 50);
  });

  it('while locked, even the right PIN is refused and not checked', async () => {
    prisma.salesAccess.upsert.mockResolvedValue(access({ lockedUntil: new Date(Date.now() + 60_000) }) as never);
    await expect(service.unlock('123456')).rejects.toMatchObject({ response: { code: 'SALES_PIN_LOCKED', retryAfterSeconds: 60 } });
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it('without a PIN the page is closed', async () => {
    prisma.salesAccess.upsert.mockResolvedValue(access({ pinHash: null }) as never);
    await expect(service.unlock('123456')).rejects.toMatchObject(code('SALES_PIN_NOT_SET'));
  });

  it('verify accepts only a token of the current PIN version', async () => {
    prisma.salesAccess.findUnique.mockResolvedValue({ version: 3, pinHash: 'hash' } as never);
    tokens.verifySlots.mockResolvedValue(3);
    await expect(service.verify('t')).resolves.toBeUndefined();
    tokens.verifySlots.mockResolvedValue(2);
    await expect(service.verify('t')).rejects.toMatchObject(code('SALES_ACCESS_REQUIRED'));
    tokens.verifySlots.mockResolvedValue(null);
    await expect(service.verify('t')).rejects.toMatchObject(code('SALES_ACCESS_REQUIRED'));
    await expect(service.verify(undefined)).rejects.toMatchObject(code('SALES_ACCESS_REQUIRED'));
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd api && npm test -- token.service sales-access` → FAIL (`signSlots` / module missing).

- [ ] **Step 3: Token and cookie helpers**

`api/src/auth/token.service.ts` — add below `CHALLENGE_AUDIENCE`:

```ts
const SLOTS_AUDIENCE = 'slots';
/** How long a phone stays unlocked on the sales slots page. */
export const SLOTS_TTL_DAYS = 90;
```

and add these methods after `verifyChallenge`:

```ts
  /**
   * Token for the sales slots page (no user). It carries the PIN version, so
   * changing the PIN invalidates every token already issued. Its audience is
   * rejected by verifyAccess, so it never opens a dashboard or showroom route.
   */
  async signSlots(version: number): Promise<{ token: string; expiresAt: Date }> {
    const token = await this.jwt.signAsync({ v: version }, { audience: SLOTS_AUDIENCE, expiresIn: SLOTS_TTL_DAYS * 86_400 });
    return { token, expiresAt: new Date(Date.now() + SLOTS_TTL_DAYS * 86_400_000) };
  }

  /** The PIN version the token was issued for, or null when the token is not a valid slots token. */
  async verifySlots(token: string): Promise<number | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ v?: unknown }>(token, { audience: SLOTS_AUDIENCE });
      return typeof payload.v === 'number' ? payload.v : null;
    } catch {
      return null;
    }
  }
```

`api/src/auth/cookies.ts` — append:

```ts
/** Sales slots page: a signed token, not a refresh token (there is no user and nothing to rotate). */
export const SLOTS_COOKIE = { name: 'wc_slt', path: '/api/slots' };
export const SLOTS_HINT_COOKIE = 'wc_slots';

export function setSlotsCookie(res: Response, token: string, expires: Date, secure: boolean): void {
  res.cookie(SLOTS_COOKIE.name, token, { httpOnly: true, secure, sameSite: 'strict', path: SLOTS_COOKIE.path, expires });
  res.cookie(SLOTS_HINT_COOKIE, '1', hintOptions(secure, expires));
}

export function readSlotsCookie(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, unknown> }).cookies;
  const value = cookies?.[SLOTS_COOKIE.name];
  return typeof value === 'string' && value.length > 0 && value.length < 1000 ? value : undefined;
}
```

- [ ] **Step 4: The service and guard**

Create `api/src/sales-access/dto/sales-access.dto.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { normaliseDigits, SALES_PIN_PATTERN } from '../../../../shared/validation';

const digits = ({ value }: { value: unknown }) => (typeof value === 'string' ? normaliseDigits(value).trim() : value);

export class PinDto {
  @Transform(digits)
  @IsString()
  @Matches(SALES_PIN_PATTERN, { message: 'pin must be exactly 6 digits' })
  pin: string;
}
```

Create `api/src/sales-access/sales-access.service.ts`:

```ts
import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditTrail } from '../activity/audit-trail.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import type { AuthUser } from '../common/types';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const ROW = { id: 1 } as const;

/**
 * The shared PIN of the sales slots page. Sales have no accounts: one PIN,
 * typed once per phone, exchanged for a 90-day token. Wrong PINs are counted
 * on the single row and lock unlocking the same way account sign-in locks
 * (LOGIN_MAX_ATTEMPTS / LOGIN_LOCK_MINUTES); phones already unlocked keep working.
 */
@Injectable()
export class SalesAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
    private readonly trail: AuditTrail,
  ) {}

  private row() {
    return this.prisma.salesAccess.upsert({ where: ROW, create: {}, update: {} });
  }

  async status(): Promise<{ pinSet: boolean; updatedAt: Date | null }> {
    const row = await this.row();
    return { pinSet: row.pinHash !== null, updatedAt: row.pinHash ? row.updatedAt : null };
  }

  /** Changing the PIN bumps the version, which signs every phone out. */
  async setPin(user: AuthUser, pin: string): Promise<{ pinSet: boolean; updatedAt: Date | null }> {
    const pinHash = await this.passwords.hash(pin);
    const row = await this.prisma.salesAccess.upsert({
      where: ROW,
      create: { pinHash, updatedById: user.id },
      update: { pinHash, version: { increment: 1 }, failedCount: 0, lockedUntil: null, updatedById: user.id },
    });
    this.trail.setEntity('SalesAccess', '1');
    return { pinSet: true, updatedAt: row.updatedAt };
  }

  async unlock(pin: string): Promise<{ token: string; expiresAt: Date }> {
    const row = await this.row();
    this.trail.setEntity('SalesAccess', '1');
    if (!row.pinHash) {
      throw new ConflictException({ statusCode: 409, error: 'Conflict', code: 'SALES_PIN_NOT_SET', message: 'The sales page has no PIN yet.' });
    }
    const wait = (row.lockedUntil?.getTime() ?? 0) - Date.now();
    if (wait > 0) {
      throw new HttpException(
        { statusCode: HttpStatus.LOCKED, error: 'Locked', code: 'SALES_PIN_LOCKED', message: 'Too many wrong PINs. Try again later.', retryAfterSeconds: Math.ceil(wait / 1000) },
        HttpStatus.LOCKED,
      );
    }
    if (!(await this.passwords.verify(row.pinHash, pin))) {
      const { failedCount } = await this.prisma.salesAccess.update({ where: ROW, data: { failedCount: { increment: 1 } }, select: { failedCount: true } });
      if (failedCount >= this.config.get('LOGIN_MAX_ATTEMPTS', { infer: true })) {
        const lockMs = this.config.get('LOGIN_LOCK_MINUTES', { infer: true }) * 60_000;
        await this.prisma.salesAccess.update({ where: ROW, data: { failedCount: 0, lockedUntil: new Date(Date.now() + lockMs) } });
      }
      throw new UnauthorizedException({ statusCode: 401, error: 'Unauthorized', code: 'SALES_PIN_INVALID', message: 'Wrong PIN.' });
    }
    if (row.failedCount > 0 || row.lockedUntil) {
      await this.prisma.salesAccess.update({ where: ROW, data: { failedCount: 0, lockedUntil: null } });
    }
    return this.tokens.signSlots(row.version);
  }

  /** Throws unless the token is a slots token issued for the PIN that is set right now. */
  async verify(token: string | undefined): Promise<void> {
    const version = token ? await this.tokens.verifySlots(token) : null;
    if (version !== null) {
      const row = await this.prisma.salesAccess.findUnique({ where: ROW, select: { version: true, pinHash: true } });
      if (row?.pinHash && row.version === version) return;
    }
    throw new UnauthorizedException({ statusCode: 401, error: 'Unauthorized', code: 'SALES_ACCESS_REQUIRED', message: 'Enter the PIN to continue.' });
  }
}
```

Create `api/src/sales-access/sales-access.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { readSlotsCookie } from '../auth/cookies';
import { SalesAccessService } from './sales-access.service';

/** For the @Public() sales routes: the request must carry a valid slots cookie. */
@Injectable()
export class SalesAccessGuard implements CanActivate {
  constructor(private readonly access: SalesAccessService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await this.access.verify(readSlotsCookie(ctx.switchToHttp().getRequest<Request>()));
    return true;
  }
}
```

- [ ] **Step 5: Controllers and module**

Create `api/src/sales-access/sales-access.controller.ts`:

```ts
import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/types';
import { PinDto } from './dto/sales-access.dto';
import { SalesAccessService } from './sales-access.service';

/** The call center's side of the sales page: is a PIN set, and setting it. */
@ApiTags('ppf')
@ApiBearerAuth()
@Controller('ppf/sales-access')
export class SalesAccessController {
  constructor(private readonly access: SalesAccessService) {}

  @RequirePermissions('booking.ppf.read')
  @Get()
  status() {
    return this.access.status();
  }

  @RequirePermissions('booking.ppf.manage')
  @Audit('sales_access.pin_change', { entity: 'SalesAccess' })
  @Put('pin')
  setPin(@CurrentUser() user: AuthUser, @Body() dto: PinDto) {
    return this.access.setPin(user, dto.pin);
  }
}
```

Create `api/src/sales-access/slots.controller.ts`:

```ts
import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { hasCsrfHeader, setSlotsCookie } from '../auth/cookies';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthThrottle } from '../common/decorators/auth-throttle.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { Env } from '../config/env';
import { CalendarQueryDto, CreateLightJobRequestDto } from '../ppf/dto/ppf.dto';
import { PpfService } from '../ppf/ppf.service';
import { PinDto } from './dto/sales-access.dto';
import { SalesAccessGuard } from './sales-access.guard';
import { SalesAccessService } from './sales-access.service';

/**
 * The sales slots page. There is no user here: the routes are public to the
 * global JWT guard and protected by the PIN cookie instead (SalesAccessGuard).
 */
@ApiTags('slots')
@Public()
@Controller('slots')
export class SlotsController {
  constructor(
    private readonly access: SalesAccessService,
    private readonly ppf: PpfService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @AuthThrottle()
  @Audit('sales_access.unlock', { entity: 'SalesAccess' })
  @Post('unlock')
  @HttpCode(200)
  async unlock(@Body() dto: PinDto, @Res({ passthrough: true }) res: Response): Promise<{ expiresAt: Date }> {
    const { token, expiresAt } = await this.access.unlock(dto.pin);
    setSlotsCookie(res, token, expiresAt, this.config.get('COOKIE_SECURE', { infer: true }));
    return { expiresAt };
  }

  @ApiCookieAuth('wc_slt')
  @UseGuards(SalesAccessGuard)
  @Get()
  view(@Query() query: CalendarQueryDto) {
    return this.ppf.salesView(query);
  }

  /** Cookie-authenticated and state-changing, so it needs the CSRF header like logout and refresh. */
  @ApiCookieAuth('wc_slt')
  @UseGuards(SalesAccessGuard)
  @Audit('ppf_request.create', { entity: 'LightJobRequest' })
  @Post('requests')
  createRequest(@Req() req: Request, @Body() dto: CreateLightJobRequestDto) {
    if (!hasCsrfHeader(req)) {
      throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'CSRF', message: 'Missing request header.' });
    }
    return this.ppf.createRequest(dto);
  }
}
```

Create `api/src/sales-access/sales-access.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PpfModule } from '../ppf/ppf.module';
import { SalesAccessController } from './sales-access.controller';
import { SalesAccessGuard } from './sales-access.guard';
import { SalesAccessService } from './sales-access.service';
import { SlotsController } from './slots.controller';

@Module({
  imports: [PpfModule],
  controllers: [SalesAccessController, SlotsController],
  providers: [SalesAccessService, SalesAccessGuard],
})
export class SalesAccessModule {}
```

Register `SalesAccessModule` in `api/src/app.module.ts` after `PpfModule`.

Add to `MATRIX` in `api/test/rbac-matrix.e2e-spec.ts`:

```ts
  'GET /api/ppf/sales-access': ['admin', 'reservations'],
  'PUT /api/ppf/sales-access/pin': ['admin', 'reservations'],
  // the sales page: no bearer token of any kind opens these, only the PIN cookie
  'POST /api/slots/unlock': { public: 400 }, // empty body
  'GET /api/slots': { public: 401 },
  'POST /api/slots/requests': { public: 401 },
```

- [ ] **Step 6: Write the e2e test**

Create `api/test/slots.e2e-spec.ts`:

```ts
import { createTestApp, type TestApp } from './utils/app';
import { bearer, csrf, login } from './utils/auth';
import { PW, seedWorld } from './utils/fixtures';

const DAY_MS = 86_400_000;
const qatarDay = (offsetDays = 0) => new Date(Date.now() + 3 * 3_600_000 + offsetDays * DAY_MS).toISOString().slice(0, 10);

describe('Sales slots page (e2e)', () => {
  let t: TestApp;
  let amani: string;
  const PIN = '482915';
  const today = qatarDay();
  const tomorrow = qatarDay(1);
  const range = { from: `${today.slice(0, 7)}-01`, to: qatarDay(40) };

  beforeAll(async () => {
    // this file unlocks many times from one IP; the strict limit has its own spec
    t = await createTestApp({ AUTH_THROTTLE_LIMIT: '1000' });
  });
  beforeEach(async () => {
    await seedWorld(t.prisma);
    amani = (await login(t, 'reservations', PW.reservations)).token;
  });
  afterAll(async () => {
    await t.close();
  });

  const setPin = (pin = PIN) => t.http().put('/api/ppf/sales-access/pin').set(bearer(amani)).send({ pin });
  const unlock = (pin = PIN) => t.http().post('/api/slots/unlock').send({ pin });
  const cookieOf = (res: { headers: Record<string, unknown> }) =>
    ((res.headers['set-cookie'] as string[] | undefined) ?? []).find((c) => c.startsWith('wc_slt='))?.split(';')[0] ?? '';
  const view = (cookie: string, q = range) => t.http().get('/api/slots').query(q).set('Cookie', cookie);
  const book = (body: Record<string, unknown>) =>
    t.http().post('/api/ppf/bookings').set(bearer(amani)).send({ type: 'FULL', car: 'Land Cruiser', ownerName: 'Khalid Al-Marri', receiveDate: tomorrow, ...body });
  const ask = (cookie: string, body: Record<string, unknown> = {}) =>
    t
      .http()
      .post('/api/slots/requests')
      .set('Cookie', cookie)
      .set(csrf)
      .send({ date: tomorrow, salesName: 'Yousef', car: 'Lexus LX', ownerName: 'Sara Al-Kuwari', note: 'Front windows tint', ...body });

  it('is closed until a PIN is set', async () => {
    expect((await t.http().get('/api/ppf/sales-access').set(bearer(amani))).body).toEqual({ pinSet: false, updatedAt: null });
    expect((await unlock()).body.code).toBe('SALES_PIN_NOT_SET');
    expect((await view('')).status).toBe(401);
  });

  it('the PIN opens the page with a strict, httpOnly cookie scoped to /api/slots', async () => {
    expect((await setPin()).body.pinSet).toBe(true);
    expect((await setPin('12345')).status).toBe(400);
    expect((await unlock('000000')).body.code).toBe('SALES_PIN_INVALID');

    const res = await unlock('٤٨٢٩١٥'); // typed on an Arabic keyboard
    expect(res.status).toBe(200);
    const raw = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('wc_slt='))!;
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Strict/i);
    expect(raw).toMatch(/Path=\/api\/slots/);
    expect((res.headers['set-cookie'] as unknown as string[]).some((c) => c.startsWith('wc_slots=1'))).toBe(true);
    expect((await view(cookieOf(res))).status).toBe(200);
  });

  it('shows days, booked cars and requests — and nothing internal', async () => {
    await setPin();
    await book({ phone: '55123456', deliveryDate: qatarDay(4), note: 'internal note', service: 'Bundle 1' });
    await book({ type: 'LIGHT', car: 'Tesla Y', ownerName: 'Noor' });
    const cookie = cookieOf(await unlock());

    const res = await view(cookie);
    expect(res.body.today).toBe(today);
    expect(res.body.days.find((d: { date: string }) => d.date === tomorrow)).toEqual({ date: tomorrow, state: 'FULL', reason: null, lightCount: 1 });
    expect(res.body.bookings).toHaveLength(2);
    expect(Object.keys(res.body.bookings[0]).sort()).toEqual(['car', 'deliveryDate', 'id', 'ownerName', 'phone', 'receiveDate', 'type']);
    expect(res.body.bookings[0]).toMatchObject({ type: 'FULL', car: 'Land Cruiser', phone: '55123456', deliveryDate: qatarDay(4) });
    const text = JSON.stringify(res.body);
    for (const leak of ['internal note', 'Bundle 1', 'createdBy', 'reservations']) expect(text).not.toContain(leak);
  });

  it('a slots cookie opens no dashboard route, and a dashboard token opens no slots route', async () => {
    await setPin();
    const cookie = cookieOf(await unlock());
    const token = cookie.replace('wc_slt=', '');
    expect((await t.http().get('/api/ppf/calendar').query(range).set(bearer(token))).status).toBe(401);
    expect((await t.http().get('/api/slots').query(range).set(bearer(amani))).status).toBe(401);
    expect((await t.http().get('/api/slots').query(range).set('Cookie', `wc_slt=${amani}`)).status).toBe(401);
  });

  it('sales can ask for a light job only on a day closed by a full PPF', async () => {
    await setPin();
    const cookie = cookieOf(await unlock());

    expect((await ask(cookie)).body.code).toBe('PPF_DAY_NOT_FULL'); // open day
    await book({});
    expect((await ask(cookie, { date: qatarDay(-1) })).body.code).toBe('REQUEST_DAY_PAST');
    expect((await t.http().post('/api/slots/requests').set('Cookie', cookie).send({})).body.code).toBe('CSRF');
    expect((await ask(cookie, { note: '' })).status).toBe(400);

    const ok = await ask(cookie, { phone: '٥٥١٢٣٤٥٦' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ date: tomorrow, salesName: 'Yousef', car: 'Lexus LX', status: 'PENDING' });
    expect((await t.prisma.lightJobRequest.findUniqueOrThrow({ where: { id: ok.body.id } })).phone).toBe('55123456');

    await t.http().put(`/api/ppf/closed-days/${tomorrow}`).set(bearer(amani)).send({});
    expect((await ask(cookie)).body.code).toBe('PPF_DAY_NOT_FULL'); // closed by hand

    const listed = await view(cookie);
    expect(listed.body.requests).toHaveLength(1);
    expect(Object.keys(listed.body.requests[0]).sort()).toEqual(['car', 'createdAt', 'date', 'decisionNote', 'id', 'salesName', 'status']);
  });

  it('the answer reaches the sales page', async () => {
    await setPin();
    await book({});
    const cookie = cookieOf(await unlock());
    const { body: req } = await ask(cookie);
    await t.http().post(`/api/ppf/requests/${req.id}/reject`).set(bearer(amani)).send({ decisionNote: 'Workshop is full that day' });
    expect((await view(cookie)).body.requests[0]).toMatchObject({ status: 'REJECTED', decisionNote: 'Workshop is full that day' });
  });

  it('changing the PIN signs every phone out', async () => {
    await setPin();
    const old = cookieOf(await unlock());
    expect((await view(old)).status).toBe(200);
    await setPin('777777');
    const res = await view(old);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SALES_ACCESS_REQUIRED');
    expect((await unlock()).body.code).toBe('SALES_PIN_INVALID');
    expect((await view(cookieOf(await unlock('777777')))).status).toBe(200);
  });

  it('five wrong PINs lock unlocking; phones already unlocked keep working', async () => {
    await setPin();
    const cookie = cookieOf(await unlock());
    for (let i = 0; i < 5; i++) expect((await unlock('000000')).status).toBe(401);
    const locked = await unlock();
    expect(locked.status).toBe(423);
    expect(locked.body.code).toBe('SALES_PIN_LOCKED');
    expect(locked.body.retryAfterSeconds).toBeGreaterThan(0);
    expect((await view(cookie)).status).toBe(200);
  });

  it('limits what sales can browse', async () => {
    await setPin();
    const cookie = cookieOf(await unlock());
    expect((await view(cookie, { from: qatarDay(-70), to: qatarDay(-40) })).body.code).toBe('BAD_RANGE');
    expect((await view(cookie, { from: today, to: '2031-02-30' })).status).toBe(400);
  });

  it('never writes the PIN to the activity log, and names the salesperson on requests', async () => {
    await setPin();
    await unlock('000000');
    const cookie = cookieOf(await unlock());
    await book({});
    await ask(cookie);
    const log = await t.prisma.activityLog.findMany({ orderBy: { id: 'asc' } });
    const text = JSON.stringify(log, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
    expect(text).not.toContain(PIN);
    expect(text).not.toContain('000000');
    expect(log.filter((l) => l.action === 'sales_access.unlock').map((l) => l.outcome)).toEqual(['FAILURE', 'SUCCESS']);
    const request = log.find((l) => l.action === 'ppf_request.create');
    expect(request).toMatchObject({ actorId: null, entityType: 'LightJobRequest', metadata: { salesName: 'Yousef' } });
  });
});
```

- [ ] **Step 7: Run everything**

```bash
cd api && npm run typecheck && npm run lint && npm test -- token.service sales-access && npm run test:e2e -- slots rbac-matrix audit-coverage
```

Expected: PASS. The audit-coverage test `only token-rotation routes skip auditing` must still pass unchanged — none of the new routes uses `@SkipAudit`.

- [ ] **Step 8: Commit**

```bash
git add api/src/auth api/src/sales-access api/src/app.module.ts api/test
git commit -m "feat(api): PIN-protected sales slots page with light-job requests"
```

---

### Task 7: General reservations (API)

**Files:**
- Create: `api/src/reservations/dto/reservations.dto.ts`, `reservation.view.ts`, `reservations.service.ts`, `reservations.service.spec.ts`, `reservations.controller.ts`, `reservations.module.ts`
- Create: `api/test/reservations.e2e-spec.ts`
- Modify: `api/src/app.module.ts`, `api/test/rbac-matrix.e2e-spec.ts`

**Interfaces:**
- Consumes: `conflict`, `bad` from `ppf/ppf.service.ts`; `BOOKING_STATUSES` from `ppf/dto/ppf.dto.ts`; day helpers; field decorators; `TIME_PATTERN`.
- Produces:
  - `ReservationView = { id: string; date: string; time: string | null; service: string; ownerName: string | null; phone: string | null; car: string | null; note: string | null; status: 'BOOKED' | 'CANCELLED'; createdBy: { id: string; displayName: string }; createdAt: Date; cancelledAt: Date | null }`
  - Routes: `GET /api/reservations?from&to&status&q&page&pageSize` → `Page<ReservationView>`; `POST /api/reservations`; `PATCH /api/reservations/:id`; `POST /api/reservations/:id/cancel`
  - Audit actions: `reservation.create`, `reservation.update`, `reservation.cancel`

- [ ] **Step 1: Write the failing unit test**

Create `api/src/reservations/reservations.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PrismaService } from '../prisma/prisma.service';
import { ReservationsService } from './reservations.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'g-1',
  date: new Date('2026-11-02T00:00:00.000Z'),
  time: '16:30',
  service: 'Ceramic coating',
  ownerName: null,
  phone: null,
  car: null,
  note: null,
  status: 'BOOKED',
  createdAt: new Date(),
  cancelledAt: null,
  createdBy: { id: 'u-1', displayName: 'Amani' },
  ...over,
});
const code = (c: string) => ({ response: { code: c } });

describe('ReservationsService', () => {
  const prisma = mockDeep<PrismaService>();
  const trail = mock<AuditTrail>();
  const service = new ReservationsService(prisma, trail);
  const amani = authUser({ id: 'u-1', role: 'RESERVATIONS', branchId: null }, ['booking.general.manage']);

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'addMetadata'] as const) trail[m].mockReturnValue(trail);
  });

  it('creates a reservation with only a day and a service', async () => {
    prisma.generalReservation.create.mockResolvedValue(row({ time: null }) as never);
    const view = await service.create(amani, { date: '2026-11-02', service: 'Ceramic coating' });
    expect(prisma.generalReservation.create.mock.calls[0][0].data).toEqual({
      date: new Date('2026-11-02T00:00:00.000Z'),
      time: null,
      service: 'Ceramic coating',
      ownerName: null,
      phone: null,
      car: null,
      note: null,
      createdById: 'u-1',
    });
    expect(view).toMatchObject({ date: '2026-11-02', time: null, status: 'BOOKED' });
  });

  it('filters by day range, status and a search over owner, phone, car and service', async () => {
    prisma.generalReservation.findMany.mockResolvedValue([]);
    prisma.generalReservation.count.mockResolvedValue(0);
    await service.list({ page: 1, pageSize: 20, from: '2026-11-01', to: '2026-11-30', status: 'BOOKED', q: 'lexus' });
    const where = prisma.generalReservation.findMany.mock.calls[0][0]?.where as { AND: unknown[] };
    expect(where.AND).toContainEqual({ date: { gte: new Date('2026-11-01T00:00:00.000Z') } });
    expect(where.AND).toContainEqual({ date: { lte: new Date('2026-11-30T00:00:00.000Z') } });
    expect(where.AND).toContainEqual({ status: 'BOOKED' });
    const contains = { contains: 'lexus', mode: 'insensitive' };
    expect(where.AND).toContainEqual({ OR: [{ ownerName: contains }, { phone: contains }, { car: contains }, { service: contains }] });
  });

  it('clears the hour with null and leaves other fields alone', async () => {
    prisma.generalReservation.findUnique.mockResolvedValue(row() as never);
    prisma.generalReservation.updateMany.mockResolvedValue({ count: 1 });
    await service.update(amani, 'g-1', { time: null });
    expect(prisma.generalReservation.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'g-1', status: 'BOOKED' },
      data: { time: null, updatedById: 'u-1' },
    });
  });

  it('a cancelled reservation cannot be changed or cancelled again', async () => {
    prisma.generalReservation.findUnique.mockResolvedValue(row({ status: 'CANCELLED', cancelledAt: new Date() }) as never);
    prisma.generalReservation.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.update(amani, 'g-1', { service: 'Polish' })).rejects.toMatchObject(code('BOOKING_CANCELLED'));
    await expect(service.cancel(amani, 'g-1')).rejects.toMatchObject(code('BOOKING_CANCELLED'));
  });

  it('404s for an unknown id and refuses an empty update', async () => {
    prisma.generalReservation.findUnique.mockResolvedValue(null);
    await expect(service.cancel(amani, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(amani, 'g-1', {})).rejects.toMatchObject(code('NOTHING_TO_UPDATE'));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd api && npm test -- reservations.service` → FAIL (module not found).

- [ ] **Step 3: DTOs and view**

Create `api/src/reservations/dto/reservations.dto.ts`:

```ts
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BOOKING_NOTE_MAX, BOOKING_SERVICE_MAX, TIME_PATTERN } from '../../../../shared/validation';
import { NameField, PhoneField, TextField } from '../../common/booking-fields';
import { IsDay } from '../../common/day';
import { PageQueryDto } from '../../common/pagination';
import { EmptyToNull, EmptyToUndefined, Trim } from '../../common/validators';
import { BOOKING_STATUSES } from '../../ppf/dto/ppf.dto';

const TIME_MESSAGE = { message: 'time must be HH:mm (24-hour)' };

export class CreateReservationDto {
  @IsDay()
  date: string;

  /** "HH:mm" in Qatar time, when an hour was agreed. */
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Matches(TIME_PATTERN, TIME_MESSAGE)
  time?: string | null;

  @TextField(BOOKING_SERVICE_MAX)
  service: string;

  @IsOptional()
  @EmptyToUndefined()
  @NameField()
  ownerName?: string | null;

  @IsOptional()
  @EmptyToUndefined()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToUndefined()
  @NameField()
  car?: string | null;

  @IsOptional()
  @EmptyToUndefined()
  @TextField(BOOKING_NOTE_MAX)
  note?: string | null;
}

/** Every field is optional; send "" or null to clear anything but the day and the service. */
export class UpdateReservationDto {
  @IsOptional()
  @IsDay()
  date?: string;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @Matches(TIME_PATTERN, TIME_MESSAGE)
  time?: string | null;

  @IsOptional()
  @TextField(BOOKING_SERVICE_MAX)
  service?: string;

  @IsOptional()
  @EmptyToNull()
  @NameField()
  ownerName?: string | null;

  @IsOptional()
  @EmptyToNull()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToNull()
  @NameField()
  car?: string | null;

  @IsOptional()
  @EmptyToNull()
  @TextField(BOOKING_NOTE_MAX)
  note?: string | null;
}

export class ListReservationsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsDay()
  from?: string;

  @IsOptional()
  @IsDay()
  to?: string;

  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: (typeof BOOKING_STATUSES)[number];

  /** matches owner name, phone, car or service */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  q?: string;
}
```

Create `api/src/reservations/reservation.view.ts`:

```ts
import { dayStr } from '../common/day';
import type { Prisma } from '../generated/prisma/client';

export const RESERVATION_SELECT = {
  id: true,
  date: true,
  time: true,
  service: true,
  ownerName: true,
  phone: true,
  car: true,
  note: true,
  status: true,
  createdAt: true,
  cancelledAt: true,
  createdBy: { select: { id: true, displayName: true } },
} satisfies Prisma.GeneralReservationSelect;

type Row = Prisma.GeneralReservationGetPayload<{ select: typeof RESERVATION_SELECT }>;

export function reservationView(r: Row) {
  return { ...r, date: dayStr(r.date) };
}
export type ReservationView = ReturnType<typeof reservationView>;

export function reservationAuditView(r: ReservationView) {
  const { id: _id, createdBy: _createdBy, createdAt: _createdAt, ...rest } = r;
  return rest;
}
```

- [ ] **Step 4: Service, controller, module**

Create `api/src/reservations/reservations.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditTrail } from '../activity/audit-trail.service';
import { toDate } from '../common/day';
import { type Page, skipTake } from '../common/pagination';
import type { AuthUser } from '../common/types';
import type { Prisma } from '../generated/prisma/client';
import { bad, conflict } from '../ppf/ppf.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateReservationDto, ListReservationsQueryDto, UpdateReservationDto } from './dto/reservations.dto';
import { RESERVATION_SELECT, reservationAuditView, reservationView, type ReservationView } from './reservation.view';

const cancelled = () => conflict('BOOKING_CANCELLED', 'A cancelled reservation cannot be changed.');

/**
 * The call center's private list of every reservation that is not a PPF
 * booking. No slots and no limits: a day, optionally an hour, and what it is for.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trail: AuditTrail,
  ) {}

  async list(q: ListReservationsQueryDto): Promise<Page<ReservationView>> {
    const and: Prisma.GeneralReservationWhereInput[] = [];
    if (q.from) and.push({ date: { gte: toDate(q.from) } });
    if (q.to) and.push({ date: { lte: toDate(q.to) } });
    if (q.status) and.push({ status: q.status });
    if (q.q) {
      const contains = { contains: q.q, mode: 'insensitive' as const };
      and.push({ OR: [{ ownerName: contains }, { phone: contains }, { car: contains }, { service: contains }] });
    }
    const where: Prisma.GeneralReservationWhereInput = { AND: and };
    const [rows, total] = await Promise.all([
      this.prisma.generalReservation.findMany({
        where,
        select: RESERVATION_SELECT,
        // reservations without an hour lead their day
        orderBy: [{ date: 'asc' }, { time: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
        ...skipTake(q),
      }),
      this.prisma.generalReservation.count({ where }),
    ]);
    return { items: rows.map(reservationView), page: q.page, pageSize: q.pageSize, total };
  }

  async create(user: AuthUser, dto: CreateReservationDto): Promise<ReservationView> {
    const row = await this.prisma.generalReservation.create({
      data: {
        date: toDate(dto.date),
        time: dto.time ?? null,
        service: dto.service,
        ownerName: dto.ownerName ?? null,
        phone: dto.phone ?? null,
        car: dto.car ?? null,
        note: dto.note ?? null,
        createdById: user.id,
      },
      select: RESERVATION_SELECT,
    });
    const view = reservationView(row);
    this.trail.setEntity('GeneralReservation', view.id).setChange(null, reservationAuditView(view));
    return view;
  }

  async update(user: AuthUser, id: string, dto: UpdateReservationDto): Promise<ReservationView> {
    if (Object.values(dto).every((v) => v === undefined)) throw bad('NOTHING_TO_UPDATE', 'Nothing to update.');
    const before = await this.get(id);
    if (before.status === 'CANCELLED') throw cancelled();
    const result = await this.prisma.generalReservation.updateMany({
      where: { id, status: 'BOOKED' },
      data: {
        ...(dto.date !== undefined ? { date: toDate(dto.date) } : {}),
        ...(dto.time !== undefined ? { time: dto.time } : {}),
        ...(dto.service !== undefined ? { service: dto.service } : {}),
        ...(dto.ownerName !== undefined ? { ownerName: dto.ownerName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.car !== undefined ? { car: dto.car } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        updatedById: user.id,
      },
    });
    if (result.count === 0) throw cancelled();
    const after = await this.get(id);
    this.trail.setEntity('GeneralReservation', id).setChange(reservationAuditView(before), reservationAuditView(after));
    return after;
  }

  async cancel(user: AuthUser, id: string): Promise<ReservationView> {
    const before = await this.get(id);
    const result = await this.prisma.generalReservation.updateMany({
      where: { id, status: 'BOOKED' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: user.id },
    });
    if (result.count === 0) throw conflict('BOOKING_CANCELLED', 'This reservation is already cancelled.');
    const after = await this.get(id);
    this.trail.setEntity('GeneralReservation', id).setChange(reservationAuditView(before), reservationAuditView(after));
    return after;
  }

  private async get(id: string): Promise<ReservationView> {
    const row = await this.prisma.generalReservation.findUnique({ where: { id }, select: RESERVATION_SELECT });
    if (!row) throw new NotFoundException('Reservation not found.');
    return reservationView(row);
  }
}
```

Create `api/src/reservations/reservations.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/types';
import { CreateReservationDto, ListReservationsQueryDto, UpdateReservationDto } from './dto/reservations.dto';
import { ReservationsService } from './reservations.service';

/** General reservations: internal to the call center, never shown to sales. */
@ApiTags('reservations')
@ApiBearerAuth()
@RequirePermissions('booking.general.manage')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  list(@Query() query: ListReservationsQueryDto) {
    return this.reservations.list(query);
  }

  @Audit('reservation.create', { entity: 'GeneralReservation' })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReservationDto) {
    return this.reservations.create(user, dto);
  }

  @Audit('reservation.update', { entity: 'GeneralReservation', idParam: 'id' })
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReservationDto) {
    return this.reservations.update(user, id, dto);
  }

  @Audit('reservation.cancel', { entity: 'GeneralReservation', idParam: 'id' })
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.cancel(user, id);
  }
}
```

Create `api/src/reservations/reservations.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
```

Register `ReservationsModule` in `api/src/app.module.ts` after `SalesAccessModule`. Add to `MATRIX`:

```ts
  'GET /api/reservations': ['admin', 'reservations'],
  'POST /api/reservations': ['admin', 'reservations'],
  'PATCH /api/reservations/:id': ['admin', 'reservations'],
  'POST /api/reservations/:id/cancel': ['admin', 'reservations'],
```

- [ ] **Step 5: Write the e2e test**

Create `api/test/reservations.e2e-spec.ts`:

```ts
import { createTestApp, type TestApp } from './utils/app';
import { bearer, login } from './utils/auth';
import { PW, seedWorld } from './utils/fixtures';

describe('General reservations (e2e)', () => {
  let t: TestApp;
  let amani: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await seedWorld(t.prisma);
    amani = (await login(t, 'reservations', PW.reservations)).token;
  });
  afterAll(async () => {
    await t.close();
  });

  const add = (body: Record<string, unknown>) => t.http().post('/api/reservations').set(bearer(amani)).send({ date: '2031-03-10', service: 'Ceramic coating', ...body });
  const list = (query: Record<string, string> = {}) => t.http().get('/api/reservations').query(query).set(bearer(amani));

  it('needs only a day and a service; nothing limits how many share a day', async () => {
    const bare = await add({});
    expect(bare.status).toBe(201);
    expect(bare.body).toMatchObject({ date: '2031-03-10', time: null, ownerName: null, phone: null, car: null, note: null, status: 'BOOKED' });
    expect((await add({ time: '16:30', ownerName: 'Sara', phone: '+974 5512 3456', car: 'Lexus LX', note: 'Calls back to confirm' })).status).toBe(201);
    expect((await add({ time: '09:00', service: 'Polish' })).status).toBe(201);

    const res = await list({ from: '2031-03-10', to: '2031-03-10' });
    expect(res.body.total).toBe(3);
    // no hour first, then by hour
    expect(res.body.items.map((r: { time: string | null }) => r.time)).toEqual([null, '09:00', '16:30']);
  });

  it('validates the hour, the day and the service', async () => {
    for (const body of [{ time: '25:00' }, { time: '4pm' }, { date: '2031-02-30' }, { service: '' }, { service: 'x'.repeat(201) }]) {
      expect((await add(body)).status).toBe(400);
    }
  });

  it('searches, edits and cancels', async () => {
    const { body: r } = await add({ ownerName: 'Sara Al-Kuwari', car: 'Lexus LX', time: '16:30' });
    await add({ service: 'Polish', date: '2031-03-12' });
    expect((await list({ q: 'lexus' })).body.items.map((x: { id: string }) => x.id)).toEqual([r.id]);
    expect((await list({ from: '2031-03-11' })).body.total).toBe(1);

    const edited = await t.http().patch(`/api/reservations/${r.id}`).set(bearer(amani)).send({ time: '', date: '2031-03-11' });
    expect(edited.body).toMatchObject({ time: null, date: '2031-03-11', ownerName: 'Sara Al-Kuwari' });

    const cancelled = await t.http().post(`/api/reservations/${r.id}/cancel`).set(bearer(amani));
    expect(cancelled.body.status).toBe('CANCELLED');
    expect((await list({ status: 'BOOKED' })).body.total).toBe(1);
    expect((await t.http().patch(`/api/reservations/${r.id}`).set(bearer(amani)).send({ service: 'Other' })).body.code).toBe('BOOKING_CANCELLED');
  });

  it('never reaches the sales page', async () => {
    await add({ ownerName: 'Hidden Customer', date: new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10) });
    await t.http().put('/api/ppf/sales-access/pin').set(bearer(amani)).send({ pin: '482915' });
    const unlocked = await t.http().post('/api/slots/unlock').send({ pin: '482915' });
    const cookie = (unlocked.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('wc_slt='))!.split(';')[0];
    const today = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
    const res = await t.http().get('/api/slots').query({ from: today, to: today }).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('Hidden Customer');
  });
});
```

- [ ] **Step 6: Run the whole API suite**

```bash
cd api && npm run typecheck && npm run lint && npm test && npm run test:e2e
```

Expected: every suite passes, including `rbac-matrix` ("the matrix lists exactly the routes the app exposes") and `audit-coverage`.

- [ ] **Step 7: Commit**

```bash
git add api/src/reservations api/src/app.module.ts api/test
git commit -m "feat(api): general reservations"
```

---

### Task 8: Web foundation — types, texts, menu and the request counter

**Files:**
- Modify: `lib/api/types.ts`, `lib/api/client.ts`
- Create: `messages/app/en/bookings.json`, `messages/app/ar/bookings.json`
- Modify: `messages/app/{en,ar}/index.ts`, `nav.json`, `errors.json`, `validation.json`, `activity.json`
- Create: `features/bookings/shared/dates.ts`, `features/bookings/shared/dates.test.ts`
- Create: `features/bookings/ppf/queries.ts`
- Modify: `features/auth/navigation.ts`, `features/auth/navigation.test.tsx`, `features/dashboard/shell.tsx`
- Create: `features/dashboard/nav-badge.test.tsx`

**Interfaces:**
- Consumes: API shapes from Tasks 4–7.
- Produces:
  - Types in `lib/api/types.ts`: `PpfBookingType`, `BookingStatus`, `DayState`, `RequestStatus`, `DayInfo`, `PpfBooking`, `PpfCalendar`, `LightJobRequest`, `SalesAccessStatus`, `GeneralReservation`, `SalesBooking`, `SalesRequest`, `SlotsView`
  - `toApiError(res: Response): Promise<ApiError>` exported from `lib/api/client.ts`
  - `features/bookings/shared/dates.ts`: `monthOf(day)`, `addMonths(month, n)`, `monthRange(month): { from: string; to: string }`, `monthCells(month): (string | null)[]`, `weekdayNames(locale): string[]`, `formatDay(day, locale, style?: "full" | "short")`, `formatMonth(month, locale)`
  - `features/bookings/ppf/queries.ts`: `ppfKeys`, `fetchCalendar(month)`, `fetchRequests()`, `fetchSalesAccess()`, `usePendingRequests(enabled: boolean): number`
  - Message namespaces `Calendar`, `PpfBookings`, `Reservations`, `Slots`; nav labels `ppfBookings`, `reservations`
  - `NavItem["icon"]` gains `"ppf" | "reservations"`

- [ ] **Step 1: Write the failing tests**

Create `features/bookings/shared/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addMonths, formatDay, formatMonth, monthCells, monthOf, monthRange, weekdayNames } from "./dates";

describe("booking date helpers", () => {
  it("knows a month's first and last day, leap years included", () => {
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("steps months across a year boundary", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
    expect(addMonths("2026-11", 12)).toBe("2027-11");
    expect(monthOf("2026-11-02")).toBe("2026-11");
  });

  it("lays a month out with weeks starting on Saturday", () => {
    // 1 November 2026 is a Sunday: one empty cell before it
    const nov = monthCells("2026-11");
    expect(nov.slice(0, 3)).toEqual([null, "2026-11-01", "2026-11-02"]);
    expect(nov).toHaveLength(31);
    // 1 August 2026 is a Saturday: no padding
    expect(monthCells("2026-08")[0]).toBe("2026-08-01");
    // 1 May 2026 is a Friday: six empty cells
    expect(monthCells("2026-05").slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-05-01"]);
  });

  it("names the weekdays Saturday first, in both languages", () => {
    expect(weekdayNames("en")[0]).toMatch(/^Sat/);
    expect(weekdayNames("en")[6]).toMatch(/^Fri/);
    expect(weekdayNames("ar")).toHaveLength(7);
    expect(weekdayNames("ar")[0]).toContain("سبت");
  });

  it("formats a day without shifting it, with Latin digits in Arabic", () => {
    expect(formatDay("2026-11-02", "en")).toMatch(/Monday/);
    expect(formatDay("2026-11-02", "en")).toMatch(/2026/);
    expect(formatDay("2026-11-02", "ar")).toMatch(/2/);
    expect(formatDay("2026-11-02", "ar")).not.toMatch(/[٠-٩]/);
    expect(formatDay("2026-11-02", "en", "short")).not.toMatch(/2026/);
    expect(formatMonth("2026-11", "en")).toMatch(/November 2026/);
  });
});
```

In `features/auth/navigation.test.tsx`, add inside `describe("permission-gated navigation")`:

```ts
  it("shows the call center the two booking pages", () => {
    expect(labels(["booking.ppf.read", "booking.ppf.manage", "booking.general.manage"])).toEqual(["overview", "ppfBookings", "reservations", "account"]);
    expect(labels(["booking.ppf.read"])).toEqual(["overview", "ppfBookings", "account"]);
  });
```

Create `features/dashboard/nav-badge.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { DashboardShell } from "./shell";

const amani = makeUser({ role: "RESERVATIONS", branch: null, permissions: ["booking.ppf.read", "booking.ppf.manage", "booking.general.manage"] });

describe("PPF requests counter in the menu", () => {
  it("shows how many light-job requests are waiting", async () => {
    let query = "";
    server.use(
      http.get("/api/ppf/requests", ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({ items: [], page: 1, pageSize: 1, total: 2 });
      }),
    );
    renderWithApp(<DashboardShell>content</DashboardShell>, { user: amani });
    expect(await screen.findByText("2 requests waiting")).toBeInTheDocument();
    expect(query).toContain("status=PENDING");
    expect(screen.getByRole("link", { name: /PPF bookings/ })).toHaveAttribute("href", "/dashboard/ppf-bookings");
    expect(screen.getByRole("link", { name: "General reservations" })).toBeInTheDocument();
  });

  it("asks for nothing when the user cannot see PPF bookings", () => {
    // MSW is set to fail on unhandled requests, so a stray call would fail this test
    renderWithApp(<DashboardShell>content</DashboardShell>, { user: makeUser({ permissions: ["order.read.branch"] }) });
    expect(screen.queryByRole("link", { name: /PPF bookings/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- features/bookings/shared/dates.test.ts features/auth/navigation.test.tsx features/dashboard/nav-badge.test.tsx` → FAIL.

- [ ] **Step 3: Types and client**

Append to `lib/api/types.ts`:

```ts
// ---- PPF bookings, general reservations, sales slots ----

export type PpfBookingType = "FULL" | "LIGHT";
export type BookingStatus = "BOOKED" | "CANCELLED";
export type DayState = "OPEN" | "FULL" | "CLOSED";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/** One day of the PPF calendar. Days are "YYYY-MM-DD" (Qatar). */
export interface DayInfo {
  date: string;
  state: DayState;
  reason: string | null;
  lightCount: number;
}

export interface PpfBooking {
  id: string;
  type: PpfBookingType;
  status: BookingStatus;
  car: string;
  ownerName: string;
  phone: string | null;
  service: string | null;
  receiveDate: string;
  deliveryDate: string | null;
  note: string | null;
  /** the salesperson whose approved request created this light job */
  requestedBy: string | null;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  cancelledAt: string | null;
}

export interface PpfCalendar {
  today: string;
  days: DayInfo[];
  bookings: PpfBooking[];
}

export interface LightJobRequest {
  id: string;
  date: string;
  salesName: string;
  car: string;
  ownerName: string;
  phone: string | null;
  note: string;
  status: RequestStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  bookingId: string | null;
  createdAt: string;
}

export interface SalesAccessStatus {
  pinSet: boolean;
  updatedAt: string | null;
}

export interface GeneralReservation {
  id: string;
  date: string;
  /** "HH:mm" or null */
  time: string | null;
  service: string;
  ownerName: string | null;
  phone: string | null;
  car: string | null;
  note: string | null;
  status: BookingStatus;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  cancelledAt: string | null;
}

export interface SalesBooking {
  id: string;
  type: PpfBookingType;
  car: string;
  ownerName: string;
  phone: string | null;
  receiveDate: string;
  deliveryDate: string | null;
}

export interface SalesRequest {
  id: string;
  date: string;
  salesName: string;
  car: string;
  status: RequestStatus;
  decisionNote: string | null;
  createdAt: string;
}

export interface SlotsView {
  today: string;
  days: DayInfo[];
  bookings: SalesBooking[];
  requests: SalesRequest[];
}
```

In `lib/api/client.ts` change `async function toApiError` to `export async function toApiError` (nothing else).

- [ ] **Step 4: Date helpers**

Create `features/bookings/shared/dates.ts`:

```ts
/**
 * Month and day maths for the booking calendars. Days are "YYYY-MM-DD" strings
 * (Qatar calendar days) and months are "YYYY-MM"; everything goes through UTC
 * so the viewer's own time zone can never shift a day.
 */
const DAY_MS = 86_400_000;
const utc = (day: string) => new Date(`${day}T00:00:00.000Z`);
const str = (date: Date) => date.toISOString().slice(0, 10);
const tag = (locale: string) => `${locale === "ar" ? "ar" : "en"}-QA-u-nu-latn`;

export const monthOf = (day: string): string => day.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [year, m] = month.split("-").map(Number);
  return str(new Date(Date.UTC(year, m - 1 + n, 1))).slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: str(new Date(Date.UTC(year, m, 0))) };
}

/** The month's days, preceded by one null per empty cell: weeks start on Saturday. */
export function monthCells(month: string): (string | null)[] {
  const { from, to } = monthRange(month);
  const cells: (string | null)[] = Array.from({ length: (utc(from).getUTCDay() + 1) % 7 }, () => null);
  for (let t = utc(from).getTime(); t <= utc(to).getTime(); t += DAY_MS) cells.push(str(new Date(t)));
  return cells;
}

/** Short weekday names, Saturday first (3 January 2026 is a Saturday). */
export function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(tag(locale), { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2026, 0, 3 + i))));
}

export function formatDay(day: string, locale: string, style: "full" | "short" = "full"): string {
  const options: Intl.DateTimeFormatOptions =
    style === "full" ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { weekday: "short", day: "numeric", month: "short" };
  return new Intl.DateTimeFormat(tag(locale), { ...options, timeZone: "UTC" }).format(utc(day));
}

export function formatMonth(month: string, locale: string): string {
  return new Intl.DateTimeFormat(tag(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(utc(`${month}-01`));
}
```

- [ ] **Step 5: Texts**

Create `messages/app/en/bookings.json`:

```json
{
  "Calendar": {
    "previous": "Previous month",
    "next": "Next month",
    "states": { "OPEN": "Open", "FULL": "Booked", "CLOSED": "Closed" },
    "light": "{count, plural, one {# light job} other {# light jobs}}",
    "today": "Today"
  },
  "PpfBookings": {
    "title": "PPF bookings",
    "subtitle": "Bin Omran. One full PPF car closes its day; light jobs fit in on any open day.",
    "tabCalendar": "Calendar",
    "tabRequests": "Requests",
    "pending": "{count, plural, one {# request waiting} other {# requests waiting}}",
    "add": "Add booking",
    "addTitle": "New booking",
    "editTitle": "Edit booking",
    "type": "Type",
    "types": { "FULL": "Full PPF", "LIGHT": "Light job" },
    "typeHints": { "FULL": "Closes the day.", "LIGHT": "Tint or a small PPF job. Never closes the day." },
    "car": "Car",
    "carHint": "Make and model",
    "ownerName": "Owner name",
    "phone": "Phone",
    "service": "Service",
    "receiveDate": "Receive day",
    "deliveryDate": "Delivery day",
    "note": "Note",
    "saved": "Booking saved",
    "cancelBooking": "Cancel booking",
    "cancelTitle": "Cancel this booking?",
    "cancelBody": "It stays in the list, marked cancelled, and its day opens again.",
    "cancelled": "Booking cancelled",
    "cancelledBadge": "Cancelled",
    "requestedBy": "Requested by {name}",
    "noBookings": "No bookings on this day.",
    "delivery": "Delivery: {date}",
    "closeDay": "Close day",
    "closeTitle": "Close this day?",
    "closeBody": "A closed day takes no new bookings. Bookings already on it stay.",
    "reason": "Reason",
    "dayClosed": "Day closed",
    "reopen": "Reopen day",
    "dayReopened": "Day reopened",
    "closedBecause": "Closed: {reason}",
    "closedNoReason": "Closed by the call center",
    "requestsEmpty": "No requests yet.",
    "requestFor": "{name} · for {date}",
    "approve": "Approve",
    "approved": "Light job added",
    "reject": "Reject",
    "rejectTitle": "Reject this request?",
    "rejectReason": "Reason (sales will see it)",
    "rejected": "Request rejected",
    "requestStatus": { "PENDING": "Waiting", "APPROVED": "Approved", "REJECTED": "Rejected" },
    "salesTitle": "Sales page",
    "salesHint": "Salespeople open this link on their phone and type the PIN once.",
    "pinSet": "A PIN is set.",
    "pinNotSet": "No PIN yet. The sales page stays closed until you set one.",
    "setPin": "Set PIN",
    "changePin": "Change PIN",
    "pinTitle": "Sales PIN",
    "pinBody": "Six digits. Changing the PIN signs every phone out.",
    "pin": "PIN",
    "generate": "Generate",
    "pinSaved": "PIN saved. Share it with the sales team."
  },
  "Reservations": {
    "title": "General reservations",
    "subtitle": "Your own list of every other reservation. Nothing here closes a day or reaches the sales page.",
    "add": "Add reservation",
    "addTitle": "New reservation",
    "editTitle": "Edit reservation",
    "date": "Day",
    "time": "Hour",
    "service": "Service",
    "ownerName": "Owner name",
    "phone": "Phone",
    "car": "Car",
    "note": "Note",
    "search": "Search name, phone, car or service",
    "showCancelled": "Show cancelled",
    "empty": "No reservations in this range.",
    "saved": "Reservation saved",
    "cancel": "Cancel reservation",
    "cancelTitle": "Cancel this reservation?",
    "cancelBody": "It stays in the list, marked cancelled.",
    "cancelled": "Reservation cancelled",
    "cancelledBadge": "Cancelled"
  },
  "Slots": {
    "title": "PPF slots",
    "branch": "Bin Omran",
    "pinSubtitle": "Enter the PIN from the call center. This phone will remember it.",
    "pin": "PIN",
    "open": "Open",
    "opening": "Opening…",
    "cars": "Booked cars",
    "showPanel": "Show booked cars",
    "hidePanel": "Hide booked cars",
    "noCars": "No cars booked from today on.",
    "receive": "Receive: {date}",
    "delivery": "Delivery: {date}",
    "noDelivery": "Delivery not set",
    "requests": "Requests",
    "noRequests": "No requests yet.",
    "requestLine": "{name} · for {date}",
    "dayOpen": "This day is open. Call the call center to book it.",
    "dayFull": "Closed: a full PPF car is booked.",
    "dayClosed": "Closed by the call center.",
    "requestLight": "Request a light job",
    "requestTitle": "Request a light job",
    "requestBody": "Light jobs only: tint or a small PPF job. The call center answers here.",
    "salesName": "Your name",
    "car": "Car",
    "ownerName": "Owner name",
    "phone": "Phone",
    "note": "What is the job?",
    "send": "Send request",
    "sent": "Request sent to the call center"
  }
}
```

Create `messages/app/ar/bookings.json`:

```json
{
  "Calendar": {
    "previous": "الشهر السابق",
    "next": "الشهر التالي",
    "states": { "OPEN": "متاح", "FULL": "محجوز", "CLOSED": "مغلق" },
    "light": "{count, plural, one {خدمة خفيفة واحدة} two {خدمتان خفيفتان} few {# خدمات خفيفة} other {# خدمة خفيفة}}",
    "today": "اليوم"
  },
  "PpfBookings": {
    "title": "حجوزات PPF",
    "subtitle": "فرع بن عمران. سيارة PPF كاملة واحدة تغلق اليوم، والخدمات الخفيفة تُضاف في أي يوم متاح.",
    "tabCalendar": "التقويم",
    "tabRequests": "الطلبات",
    "pending": "{count, plural, one {طلب واحد بالانتظار} two {طلبان بالانتظار} few {# طلبات بالانتظار} other {# طلبًا بالانتظار}}",
    "add": "إضافة حجز",
    "addTitle": "حجز جديد",
    "editTitle": "تعديل الحجز",
    "type": "النوع",
    "types": { "FULL": "PPF كامل", "LIGHT": "خدمة خفيفة" },
    "typeHints": { "FULL": "يغلق اليوم.", "LIGHT": "تظليل أو PPF بسيط. لا يغلق اليوم." },
    "car": "السيارة",
    "carHint": "النوع والموديل",
    "ownerName": "اسم المالك",
    "phone": "رقم الهاتف",
    "service": "الخدمة",
    "receiveDate": "يوم الاستلام",
    "deliveryDate": "يوم التسليم",
    "note": "ملاحظة",
    "saved": "تم حفظ الحجز",
    "cancelBooking": "إلغاء الحجز",
    "cancelTitle": "إلغاء هذا الحجز؟",
    "cancelBody": "يبقى في القائمة بحالة ملغي، ويُفتح يومه من جديد.",
    "cancelled": "تم إلغاء الحجز",
    "cancelledBadge": "ملغي",
    "requestedBy": "بطلب من {name}",
    "noBookings": "لا توجد حجوزات في هذا اليوم.",
    "delivery": "التسليم: {date}",
    "closeDay": "إغلاق اليوم",
    "closeTitle": "إغلاق هذا اليوم؟",
    "closeBody": "اليوم المغلق لا يقبل حجوزات جديدة. الحجوزات الموجودة فيه تبقى.",
    "reason": "السبب",
    "dayClosed": "تم إغلاق اليوم",
    "reopen": "إعادة فتح اليوم",
    "dayReopened": "تم فتح اليوم",
    "closedBecause": "مغلق: {reason}",
    "closedNoReason": "أغلقه مركز الاتصال",
    "requestsEmpty": "لا توجد طلبات بعد.",
    "requestFor": "{name} · ليوم {date}",
    "approve": "موافقة",
    "approved": "تمت إضافة الخدمة الخفيفة",
    "reject": "رفض",
    "rejectTitle": "رفض هذا الطلب؟",
    "rejectReason": "السبب (سيراه موظف المبيعات)",
    "rejected": "تم رفض الطلب",
    "requestStatus": { "PENDING": "بالانتظار", "APPROVED": "تمت الموافقة", "REJECTED": "مرفوض" },
    "salesTitle": "صفحة المبيعات",
    "salesHint": "يفتح موظفو المبيعات هذا الرابط من الجوال ويُدخلون الرمز مرة واحدة.",
    "pinSet": "تم تعيين رمز.",
    "pinNotSet": "لا يوجد رمز بعد. صفحة المبيعات مغلقة حتى تعيّني رمزًا.",
    "setPin": "تعيين الرمز",
    "changePin": "تغيير الرمز",
    "pinTitle": "رمز المبيعات",
    "pinBody": "ستة أرقام. تغيير الرمز يسجّل خروج كل الجوالات.",
    "pin": "الرمز",
    "generate": "توليد",
    "pinSaved": "تم حفظ الرمز. شاركيه مع فريق المبيعات."
  },
  "Reservations": {
    "title": "الحجوزات العامة",
    "subtitle": "قائمتك الخاصة لكل الحجوزات الأخرى. لا شيء هنا يغلق يومًا أو يظهر في صفحة المبيعات.",
    "add": "إضافة حجز",
    "addTitle": "حجز جديد",
    "editTitle": "تعديل الحجز",
    "date": "اليوم",
    "time": "الساعة",
    "service": "الخدمة",
    "ownerName": "اسم المالك",
    "phone": "رقم الهاتف",
    "car": "السيارة",
    "note": "ملاحظة",
    "search": "ابحث بالاسم أو الهاتف أو السيارة أو الخدمة",
    "showCancelled": "إظهار الملغي",
    "empty": "لا توجد حجوزات في هذه الفترة.",
    "saved": "تم حفظ الحجز",
    "cancel": "إلغاء الحجز",
    "cancelTitle": "إلغاء هذا الحجز؟",
    "cancelBody": "يبقى في القائمة بحالة ملغي.",
    "cancelled": "تم إلغاء الحجز",
    "cancelledBadge": "ملغي"
  },
  "Slots": {
    "title": "مواعيد PPF",
    "branch": "بن عمران",
    "pinSubtitle": "أدخل الرمز الذي أعطاك إياه مركز الاتصال. سيتذكره هذا الجوال.",
    "pin": "الرمز",
    "open": "فتح",
    "opening": "جارٍ الفتح…",
    "cars": "السيارات المحجوزة",
    "showPanel": "إظهار السيارات المحجوزة",
    "hidePanel": "إخفاء السيارات المحجوزة",
    "noCars": "لا توجد سيارات محجوزة من اليوم فصاعدًا.",
    "receive": "الاستلام: {date}",
    "delivery": "التسليم: {date}",
    "noDelivery": "لم يُحدَّد التسليم",
    "requests": "الطلبات",
    "noRequests": "لا توجد طلبات بعد.",
    "requestLine": "{name} · ليوم {date}",
    "dayOpen": "هذا اليوم متاح. اتصل بمركز الاتصال للحجز.",
    "dayFull": "مغلق: توجد سيارة PPF كامل محجوزة.",
    "dayClosed": "أغلقه مركز الاتصال.",
    "requestLight": "طلب خدمة خفيفة",
    "requestTitle": "طلب خدمة خفيفة",
    "requestBody": "للخدمات الخفيفة فقط: تظليل أو PPF بسيط. يرد مركز الاتصال هنا.",
    "salesName": "اسمك",
    "car": "السيارة",
    "ownerName": "اسم المالك",
    "phone": "رقم الهاتف",
    "note": "ما هي الخدمة المطلوبة؟",
    "send": "إرسال الطلب",
    "sent": "تم إرسال الطلب إلى مركز الاتصال"
  }
}
```

In both `messages/app/en/index.ts` and `messages/app/ar/index.ts`: `import bookings from "./bookings.json";` and add `...bookings,` as the last entry of the `messages` object (its four top-level keys become namespaces).

Add these keys to the other message files:

| File | Key | English | Arabic |
|---|---|---|---|
| `nav.json` | `ppfBookings` | `PPF bookings` | `حجوزات PPF` |
| `nav.json` | `reservations` | `General reservations` | `الحجوزات العامة` |
| `validation.json` | `phone` | `Digits only, with an optional + at the start (6–20).` | `أرقام فقط، ويمكن أن يبدأ بعلامة + (من 6 إلى 20).` |
| `validation.json` | `pin` | `Enter 6 digits.` | `أدخل 6 أرقام.` |
| `validation.json` | `deliveryBeforeReceive` | `The delivery day can't be before the receive day.` | `يوم التسليم لا يمكن أن يسبق يوم الاستلام.` |
| `errors.json` | `PPF_DAY_FULL` | `A full PPF is already booked on this day.` | `يوجد حجز PPF كامل في هذا اليوم.` |
| `errors.json` | `PPF_DAY_CLOSED` | `This day is closed. Reopen it first.` | `هذا اليوم مغلق. افتحيه أولًا.` |
| `errors.json` | `PPF_DAY_NOT_FULL` | `Requests are only for days closed by a full PPF.` | `الطلبات فقط للأيام المغلقة بحجز PPF كامل.` |
| `errors.json` | `BOOKING_CANCELLED` | `This is cancelled and can't be changed.` | `هذا الحجز ملغي ولا يمكن تعديله.` |
| `errors.json` | `REQUEST_ALREADY_DECIDED` | `This request was already answered.` | `تم الرد على هذا الطلب من قبل.` |
| `errors.json` | `REQUEST_DAY_PAST` | `This day has already passed.` | `هذا اليوم قد مضى.` |
| `errors.json` | `DELIVERY_BEFORE_RECEIVE` | `The delivery day can't be before the receive day.` | `يوم التسليم لا يمكن أن يسبق يوم الاستلام.` |
| `errors.json` | `BAD_RANGE` | `That date range isn't available.` | `هذه الفترة غير متاحة.` |
| `errors.json` | `SALES_PIN_NOT_SET` | `This page isn't open yet. Ask the call center.` | `الصفحة غير مفعّلة بعد. تواصل مع مركز الاتصال.` |
| `errors.json` | `SALES_PIN_INVALID` | `Wrong PIN.` | `الرمز غير صحيح.` |
| `errors.json` | `SALES_PIN_LOCKED` | `Too many wrong PINs. Try again in {minutes} min.` | `محاولات خاطئة كثيرة. حاول بعد {minutes} دقيقة.` |
| `errors.json` | `SALES_ACCESS_REQUIRED` | `Enter the PIN to continue.` | `أدخل الرمز للمتابعة.` |
| `activity.json` | `entityTypes.PpfBooking` | `PPF booking` | `حجز PPF` |
| `activity.json` | `entityTypes.PpfClosedDay` | `Closed day` | `يوم مغلق` |
| `activity.json` | `entityTypes.LightJobRequest` | `Light-job request` | `طلب خدمة خفيفة` |
| `activity.json` | `entityTypes.GeneralReservation` | `General reservation` | `حجز عام` |
| `activity.json` | `entityTypes.SalesAccess` | `Sales page` | `صفحة المبيعات` |
| `activity.json` | `actions.ppf_booking_create` | `PPF booking added` | `إضافة حجز PPF` |
| `activity.json` | `actions.ppf_booking_update` | `PPF booking edited` | `تعديل حجز PPF` |
| `activity.json` | `actions.ppf_booking_cancel` | `PPF booking cancelled` | `إلغاء حجز PPF` |
| `activity.json` | `actions.ppf_day_close` | `Day closed` | `إغلاق يوم` |
| `activity.json` | `actions.ppf_day_reopen` | `Day reopened` | `إعادة فتح يوم` |
| `activity.json` | `actions.ppf_request_create` | `Light job requested` | `طلب خدمة خفيفة` |
| `activity.json` | `actions.ppf_request_approve` | `Request approved` | `الموافقة على طلب` |
| `activity.json` | `actions.ppf_request_reject` | `Request rejected` | `رفض طلب` |
| `activity.json` | `actions.sales_access_pin_change` | `Sales PIN changed` | `تغيير رمز المبيعات` |
| `activity.json` | `actions.sales_access_unlock` | `Sales page unlocked` | `فتح صفحة المبيعات` |
| `activity.json` | `actions.reservation_create` | `Reservation added` | `إضافة حجز عام` |
| `activity.json` | `actions.reservation_update` | `Reservation edited` | `تعديل حجز عام` |
| `activity.json` | `actions.reservation_cancel` | `Reservation cancelled` | `إلغاء حجز عام` |

- [ ] **Step 6: Queries and the counter**

Create `features/bookings/ppf/queries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { LightJobRequest, Page, PpfCalendar, SalesAccessStatus } from "@/lib/api/types";
import { monthRange } from "../shared/dates";

/** Everything under ["ppf"] is refreshed together after any change. */
export const ppfKeys = {
  all: ["ppf"] as const,
  calendar: (month: string) => ["ppf", "calendar", month] as const,
  requests: ["ppf", "requests"] as const,
  pending: ["ppf", "pending"] as const,
  salesAccess: ["ppf", "sales-access"] as const,
};

export const fetchCalendar = (month: string) => api<PpfCalendar>("/ppf/calendar", { query: monthRange(month) });
export const fetchRequests = () => api<Page<LightJobRequest>>("/ppf/requests", { query: { pageSize: 50 } });
export const fetchSalesAccess = () => api<SalesAccessStatus>("/ppf/sales-access");

/** How many light-job requests are waiting; re-checked every minute. */
export function usePendingRequests(enabled: boolean): number {
  const query = useQuery({
    queryKey: ppfKeys.pending,
    queryFn: () => api<Page<LightJobRequest>>("/ppf/requests", { query: { status: "PENDING", pageSize: 1 } }),
    enabled,
    refetchInterval: 60_000,
  });
  return query.data?.total ?? 0;
}
```

- [ ] **Step 7: Menu**

`features/auth/navigation.ts` — extend the icon union and add two items after `orders`:

```ts
  icon: "home" | "products" | "orders" | "ppf" | "reservations" | "users" | "branches" | "permissions" | "activity" | "account" | "showroom";
```

```ts
  { href: "/dashboard/ppf-bookings", label: "ppfBookings", any: ["booking.ppf.read"], icon: "ppf" },
  { href: "/dashboard/reservations", label: "reservations", any: ["booking.general.manage"], icon: "reservations" },
```

`features/dashboard/shell.tsx`:

- import `CalendarCheck` and `CalendarClock` from `lucide-react`, and `usePendingRequests` from `@/features/bookings/ppf/queries`;
- add `ppf: CalendarCheck,` and `reservations: CalendarClock,` to `ICONS`;
- in `NavLinks`, after `const items = …`, add:

```ts
  const tp = useTranslations("PpfBookings");
  const pending = usePendingRequests(can("booking.ppf.read"));
```

- inside the `<Link>`, after `{t(item.label)}`, add:

```tsx
            {item.icon === "ppf" && pending > 0 && (
              <span className="ms-auto grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-[12px] font-extrabold text-white tabular-nums">
                <span aria-hidden="true">{pending}</span>
                <span className="sr-only">{tp("pending", { count: pending })}</span>
              </span>
            )}
```

- [ ] **Step 8: Run the tests**

Run: `npm run typecheck && npm run lint && npm test` → PASS (whole web suite, so the existing shell and navigation tests are covered too).

- [ ] **Step 9: Commit**

```bash
git add lib features messages
git commit -m "feat(web): booking types, texts, menu items and the waiting-requests counter"
```

---

### Task 9: The month calendar and shared form fields

**Files:**
- Create: `features/bookings/shared/month-calendar.tsx`, `features/bookings/shared/month-calendar.test.tsx`
- Create: `features/bookings/shared/schemas.ts`, `features/bookings/shared/schemas.test.ts`

**Interfaces:**
- Consumes: `DayInfo` (types); `monthCells`, `weekdayNames`, `formatDay`, `formatMonth`, `addMonths` (Task 8); message namespace `Calendar`.
- Produces:
  - `MonthCalendar(props: { month: string; days: DayInfo[] | undefined; today: string | undefined; selected: string | null; onSelect: (date: string) => void; onMonthChange: (month: string) => void; minMonth?: string; maxMonth?: string })`. Each day is a `<button data-date="YYYY-MM-DD" data-state="OPEN|FULL|CLOSED" aria-pressed>`; tests and Playwright find days with `button[data-date="…"]`.
  - `schemas.ts`: zod fields `nameField`, `optionalName`, `optionalPhone`, `optionalText(max)`, `requiredText(max)`, `dayField`, `optionalDay`, `optionalTime`, `pinField`. Error messages are `Validation.*` keys.

- [ ] **Step 1: Write the failing tests**

Create `features/bookings/shared/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dayField, nameField, optionalDay, optionalPhone, optionalTime, pinField, requiredText } from "./schemas";

const error = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, value: unknown) =>
  schema.safeParse(value).error?.issues[0]?.message;

describe("booking form fields", () => {
  it("names: trimmed, 2 to 80 characters, any script", () => {
    expect(nameField.parse("  خالد المري ")).toBe("خالد المري");
    expect(error(nameField, "")).toBe("required");
    expect(error(nameField, "A")).toBe("tooShort");
    expect(error(nameField, "x".repeat(81))).toBe("tooLong");
  });

  it("phone: optional, digits typed in Arabic become 0-9", () => {
    expect(optionalPhone.parse("")).toBe("");
    expect(optionalPhone.parse(" ٥٥١٢٣٤٥٦ ")).toBe("55123456");
    expect(optionalPhone.parse("+974 5512 3456")).toBe("+974 5512 3456");
    expect(error(optionalPhone, "call me")).toBe("phone");
    expect(error(optionalPhone, "123")).toBe("phone");
  });

  it("days and hours", () => {
    expect(dayField.parse("2031-03-10")).toBe("2031-03-10");
    expect(error(dayField, "")).toBe("required");
    expect(optionalDay.parse("")).toBe("");
    expect(error(optionalDay, "10/03/2031")).toBe("invalid");
    expect(optionalTime.parse("16:30")).toBe("16:30");
    expect(optionalTime.parse("")).toBe("");
    expect(error(optionalTime, "25:00")).toBe("invalid");
  });

  it("required text and the PIN", () => {
    expect(error(requiredText(200), "   ")).toBe("required");
    expect(error(requiredText(5), "too long")).toBe("tooLong");
    expect(pinField.parse("٤٨٢٩١٥")).toBe("482915");
    expect(error(pinField, "12345")).toBe("pin");
  });
});
```

Create `features/bookings/shared/month-calendar.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DayInfo } from "@/lib/api/types";
import { renderWithApp } from "@/tests/render";
import { MonthCalendar } from "./month-calendar";

const day = (date: string, over: Partial<DayInfo> = {}): DayInfo => ({ date, state: "OPEN", reason: null, lightCount: 0, ...over });
const DAYS: DayInfo[] = Array.from({ length: 30 }, (_, i) => day(`2026-11-${String(i + 1).padStart(2, "0")}`));
DAYS[1] = day("2026-11-02", { state: "FULL", lightCount: 2 });
DAYS[2] = day("2026-11-03", { state: "CLOSED", reason: "National Day" });

const cell = (date: string) => document.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)!;

function setup(props: Partial<Parameters<typeof MonthCalendar>[0]> = {}) {
  const onSelect = vi.fn();
  const onMonthChange = vi.fn();
  const utils = renderWithApp(
    <MonthCalendar month="2026-11" days={DAYS} today="2026-11-02" selected={null} onSelect={onSelect} onMonthChange={onMonthChange} {...props} />,
  );
  return { ...utils, onSelect, onMonthChange };
}

describe("MonthCalendar", () => {
  it("shows every day with its state, in words and not only in colour", () => {
    setup();
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(document.querySelectorAll("button[data-date]")).toHaveLength(30);
    expect(cell("2026-11-01")).toHaveAttribute("data-state", "OPEN");
    expect(cell("2026-11-02")).toHaveAttribute("data-state", "FULL");
    expect(cell("2026-11-02")).toHaveAccessibleName(/Booked/);
    expect(cell("2026-11-02")).toHaveAccessibleName(/2 light jobs/);
    expect(cell("2026-11-03")).toHaveAccessibleName(/Closed/);
    expect(cell("2026-11-02")).toHaveAttribute("aria-current", "date");
  });

  it("selects a day and marks it pressed", async () => {
    const { user, onSelect } = setup({ selected: "2026-11-03" });
    expect(cell("2026-11-03")).toHaveAttribute("aria-pressed", "true");
    await user.click(cell("2026-11-10"));
    expect(onSelect).toHaveBeenCalledWith("2026-11-10");
  });

  it("moves between months and stops at the limits", async () => {
    const { user, onMonthChange } = setup({ minMonth: "2026-11", maxMonth: "2027-11" });
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-12");
  });

  it("days cannot be picked while the month is loading", () => {
    setup({ days: undefined });
    expect(cell("2026-11-01")).toBeDisabled();
  });

  it("renders in Arabic", () => {
    renderWithApp(<MonthCalendar month="2026-11" days={DAYS} today="2026-11-02" selected={null} onSelect={() => undefined} onMonthChange={() => undefined} />, { locale: "ar" });
    expect(screen.getByRole("button", { name: "الشهر التالي" })).toBeInTheDocument();
    expect(cell("2026-11-02")).toHaveAccessibleName(/محجوز/);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- features/bookings/shared` → FAIL (modules not found).

- [ ] **Step 3: Form fields**

Create `features/bookings/shared/schemas.ts`:

```ts
import { z } from "zod";
import {
  BOOKING_NAME_MAX,
  BOOKING_NAME_MIN,
  DAY_PATTERN,
  normaliseDigits,
  PHONE_PATTERN,
  SALES_PIN_PATTERN,
  TIME_PATTERN,
} from "@/shared/validation";

/** Messages are Validation.* keys (translated by <Field> / useFieldError). The API applies the same rules. */
const clean = (v: string) => v.trim().replace(/\s+/g, " ");

export const nameField = z.string().transform(clean).pipe(z.string().min(1, "required").min(BOOKING_NAME_MIN, "tooShort").max(BOOKING_NAME_MAX, "tooLong"));
/** "" (none) or a name. */
export const optionalName = z
  .string()
  .transform(clean)
  .pipe(z.string().max(BOOKING_NAME_MAX, "tooLong").refine((v) => v === "" || v.length >= BOOKING_NAME_MIN, "tooShort"));
export const optionalPhone = z
  .string()
  .transform((v) => clean(normaliseDigits(v)))
  .pipe(z.string().refine((v) => v === "" || PHONE_PATTERN.test(v), "phone"));
export const optionalText = (max: number) => z.string().trim().max(max, "tooLong");
export const requiredText = (max: number) => z.string().trim().min(1, "required").max(max, "tooLong");
export const dayField = z.string().min(1, "required").regex(DAY_PATTERN, "invalid");
export const optionalDay = z.string().refine((v) => v === "" || DAY_PATTERN.test(v), "invalid");
export const optionalTime = z.string().refine((v) => v === "" || TIME_PATTERN.test(v), "invalid");
export const pinField = z
  .string()
  .transform((v) => normaliseDigits(v).trim())
  .pipe(z.string().regex(SALES_PIN_PATTERN, "pin"));
```

- [ ] **Step 4: The calendar**

Create `features/bookings/shared/month-calendar.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { DayInfo, DayState } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { addMonths, formatDay, formatMonth, monthCells, weekdayNames } from "./dates";

const STATE_CLASS: Record<DayState, string> = {
  OPEN: "border-line bg-surface hover:border-ink",
  FULL: "border-transparent bg-danger-soft text-danger",
  CLOSED: "border-transparent bg-sand text-muted",
};

/**
 * One month of the PPF calendar, weeks starting on Saturday. Used by the call
 * center's page and by the sales page; it only shows and selects days — what
 * can be done with a day is up to the page. The state is always written out
 * (never colour alone).
 */
export function MonthCalendar({
  month,
  days,
  today,
  selected,
  onSelect,
  onMonthChange,
  minMonth,
  maxMonth,
}: {
  month: string;
  /** undefined while loading: the grid is drawn, the days are disabled */
  days: DayInfo[] | undefined;
  today: string | undefined;
  selected: string | null;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
  minMonth?: string;
  maxMonth?: string;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const byDate = new Map((days ?? []).map((d) => [d.date, d]));
  const title = formatMonth(month, locale);

  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t("previous")}
          disabled={minMonth !== undefined && month <= minMonth}
          onClick={() => onMonthChange(addMonths(month, -1))}
        >
          <ChevronLeft className="rtl:-scale-x-100" aria-hidden="true" />
        </Button>
        <h2 className="text-lg font-extrabold" aria-live="polite">
          {title}
        </h2>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("next")}
          disabled={maxMonth !== undefined && month >= maxMonth}
          onClick={() => onMonthChange(addMonths(month, 1))}
        >
          <ChevronRight className="rtl:-scale-x-100" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-bold text-muted" aria-hidden="true">
        {weekdayNames(locale).map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {monthCells(month).map((date, i) => {
          if (date === null) return <span key={`pad-${i}`} />;
          const info = byDate.get(date);
          const state = info?.state ?? "OPEN";
          const label = [
            formatDay(date, locale),
            info ? t(`states.${state}`) : null,
            info && info.lightCount > 0 ? t("light", { count: info.lightCount }) : null,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              data-state={state}
              aria-label={label}
              aria-pressed={selected === date}
              aria-current={today === date ? "date" : undefined}
              disabled={!info}
              onClick={() => onSelect(date)}
              className={cn(
                "grid min-h-[58px] content-between rounded-[var(--radius-brand)] border-[1.5px] p-1.5 text-start transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink disabled:opacity-50",
                STATE_CLASS[state],
                selected === date && "border-ink ring-2 ring-ink",
                today !== undefined && date < today && "opacity-60",
              )}
            >
              <span className={cn("text-[15px] leading-none font-extrabold tabular-nums", today === date && "underline underline-offset-4")}>
                {Number(date.slice(8))}
              </span>
              <span className="text-[11px] leading-tight font-bold">
                {info && state !== "OPEN" ? t(`states.${state}`) : ""}
                {info && info.lightCount > 0 && <span className="block font-semibold text-ink-2">+{info.lightCount}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-ink-2" aria-hidden="true">
        {(["OPEN", "FULL", "CLOSED"] as const).map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-[4px] border", STATE_CLASS[state])} />
            {t(`states.${state}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- features/bookings/shared && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 6: Commit**

```bash
git add features/bookings/shared
git commit -m "feat(web): month calendar and shared booking form fields"
```

---

### Task 10: PPF bookings page — calendar, day panel, booking form, closing a day

**Files:**
- Create: `features/bookings/ppf/booking-form.tsx`, `features/bookings/ppf/day-panel.tsx`, `features/bookings/ppf/ppf-bookings-page.tsx`
- Create: `features/bookings/ppf/ppf-fixtures.ts`, `features/bookings/ppf/ppf-bookings-page.test.tsx`
- Create: `app/[locale]/(app)/(staff)/dashboard/ppf-bookings/page.tsx`

**Interfaces:**
- Consumes: `MonthCalendar`, `schemas.ts`, `dates.ts`, `ppfKeys`, `fetchCalendar` (Tasks 8–9); `api`, `useErrorMessage`, `useAuth`, `PageHeader`, `NoAccess`, `ErrorState`, `ConfirmDialog`, `Field`, `Pill`, `applyFieldErrors`, `useFieldError`, `qatarDay` (existing).
- Produces:
  - `BookingDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; booking: PpfBooking | null; defaultDate: string; onSaved: () => void })`
  - `DayPanel(props: { date: string; info: DayInfo | undefined; bookings: PpfBooking[]; canManage: boolean; onAdd: () => void; onEdit: (b: PpfBooking) => void; onCancel: (b: PpfBooking) => void; onClose: () => void; onReopen: () => void })`
  - `PpfBookingsPage()` and, in the same file, `CalendarTab({ canManage }: { canManage: boolean })` (Task 11 wraps it in tabs)
  - Test fixtures `ppf-fixtures.ts`: `NOW`, `TODAY`, `booking(over)`, `calendarOf(bookings, closed?)`, `page(items)`, `registerPpfDefaults()`

- [ ] **Step 1: Write the fixtures and the failing test**

Create `features/bookings/ppf/ppf-fixtures.ts`:

```ts
import { http, HttpResponse } from "msw";
import type { DayInfo, LightJobRequest, PpfBooking, PpfCalendar } from "@/lib/api/types";
import { server } from "@/tests/msw";

/** Tests freeze the clock here: 10 March 2031, noon in Qatar. */
export const NOW = new Date("2031-03-10T09:00:00.000Z");
export const TODAY = "2031-03-10";

export const booking = (over: Partial<PpfBooking> = {}): PpfBooking => ({
  id: "b-1",
  type: "FULL",
  status: "BOOKED",
  car: "Land Cruiser 2024",
  ownerName: "Khalid Al-Marri",
  phone: "55123456",
  service: "Bundle 1",
  receiveDate: TODAY,
  deliveryDate: "2031-03-13",
  note: null,
  requestedBy: null,
  createdBy: { id: "u-1", displayName: "Amani" },
  createdAt: "2031-03-01T08:00:00.000Z",
  cancelledAt: null,
  ...over,
});

/** March 2031 as the API would return it for these bookings and closed days. */
export function calendarOf(bookings: PpfBooking[], closed: Record<string, string | null> = {}): PpfCalendar {
  const days: DayInfo[] = Array.from({ length: 31 }, (_, i) => {
    const date = `2031-03-${String(i + 1).padStart(2, "0")}`;
    const active = bookings.filter((b) => b.status === "BOOKED" && b.receiveDate === date);
    const isClosed = date in closed;
    return {
      date,
      state: isClosed ? "CLOSED" : active.some((b) => b.type === "FULL") ? "FULL" : "OPEN",
      reason: isClosed ? closed[date] : null,
      lightCount: active.filter((b) => b.type === "LIGHT").length,
    };
  });
  return { today: TODAY, days, bookings };
}

export const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 50, total: items.length });

/** Quiet defaults for everything the page loads besides the calendar. */
export function registerPpfDefaults(requests: LightJobRequest[] = []) {
  server.use(
    http.get("/api/ppf/requests", ({ request }) => {
      const status = new URL(request.url).searchParams.get("status");
      return HttpResponse.json(page(status ? requests.filter((r) => r.status === status) : requests));
    }),
    http.get("/api/ppf/sales-access", () => HttpResponse.json({ pinSet: false, updatedAt: null })),
  );
}
```

Create `features/bookings/ppf/ppf-bookings-page.test.tsx`:

```tsx
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PpfBooking } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { booking, calendarOf, NOW, TODAY, registerPpfDefaults } from "./ppf-fixtures";
import { PpfBookingsPage } from "./ppf-bookings-page";

const amani = makeUser({ role: "RESERVATIONS", branch: null, permissions: ["booking.ppf.read", "booking.ppf.manage", "booking.general.manage"] });
const viewer = makeUser({ role: "FINANCE", branch: null, permissions: ["booking.ppf.read"] });
const cell = (date: string) => document.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)!;

/** Serves `bookings` as March 2031 and records what the page asked for. */
function serveCalendar(bookings: PpfBooking[], closed: Record<string, string | null> = {}) {
  const calls: string[] = [];
  server.use(
    http.get("/api/ppf/calendar", ({ request }) => {
      calls.push(new URL(request.url).search);
      return HttpResponse.json(calendarOf(bookings, closed));
    }),
  );
  return calls;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  registerPpfDefaults();
});
afterEach(() => vi.useRealTimers());

describe("PPF bookings page", () => {
  it("needs booking.ppf.read", () => {
    renderWithApp(<PpfBookingsPage />, { user: makeUser({ permissions: ["order.read.branch"] }) });
    expect(screen.getByRole("alert")).toHaveTextContent("View PPF bookings");
  });

  it("opens on today's month and lists today's bookings", async () => {
    const calls = serveCalendar([booking(), booking({ id: "b-2", type: "LIGHT", car: "Lexus LX", service: "Tint", requestedBy: "Yousef", deliveryDate: null })]);
    renderWithApp(<PpfBookingsPage />, { user: amani });

    const full = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    expect(calls[0]).toBe("?from=2031-03-01&to=2031-03-31");
    expect(cell(TODAY)).toHaveAttribute("data-state", "FULL");
    expect(within(full).getByText("Full PPF")).toBeInTheDocument();
    expect(within(full).getByText(/Khalid Al-Marri/)).toBeInTheDocument();
    expect(within(full).getByText("55123456")).toBeInTheDocument();
    expect(within(full).getByText(/Delivery:/)).toBeInTheDocument();
    const light = screen.getByRole("article", { name: "Lexus LX" });
    expect(within(light).getByText("Requested by Yousef")).toBeInTheDocument();
  });

  it("adds a booking on the selected day", async () => {
    let body: unknown;
    const bookings: PpfBooking[] = [];
    serveCalendar(bookings);
    server.use(
      http.post("/api/ppf/bookings", async ({ request }) => {
        body = await request.json();
        bookings.push(booking({ id: "b-9", receiveDate: "2031-03-12", car: "Patrol" }));
        return HttpResponse.json(bookings[0], { status: 201 });
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    await user.click(screen.getByRole("button", { name: "Add booking" }));

    const dialog = await screen.findByRole("dialog", { name: "New booking" });
    expect(within(dialog).getByRole("radio", { name: /Full PPF/ })).toBeChecked();
    expect(within(dialog).getByLabelText("Receive day")).toHaveValue("2031-03-12");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findAllByText("This field is required.")).toHaveLength(2);

    await user.type(within(dialog).getByLabelText("Car"), "Patrol");
    await user.type(within(dialog).getByLabelText("Owner name"), "Hamad Al-Thani");
    await user.type(within(dialog).getByLabelText(/Phone/), "٥٥٩٩٨٨٧٧");
    fireEvent.change(within(dialog).getByLabelText(/Delivery day/), { target: { value: "2031-03-15" } });
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(body).toEqual({
      type: "FULL",
      car: "Patrol",
      ownerName: "Hamad Al-Thani",
      phone: "55998877",
      service: "",
      receiveDate: "2031-03-12",
      deliveryDate: "2031-03-15",
      note: "",
    });
    expect(await screen.findByRole("article", { name: "Patrol" })).toBeInTheDocument();
  });

  it("refuses a delivery day before the receive day without calling the server", async () => {
    serveCalendar([]);
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Add booking" }));
    const dialog = await screen.findByRole("dialog", { name: "New booking" });
    await user.type(within(dialog).getByLabelText("Car"), "Patrol");
    await user.type(within(dialog).getByLabelText("Owner name"), "Hamad");
    fireEvent.change(within(dialog).getByLabelText(/Delivery day/), { target: { value: "2031-03-09" } });
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("The delivery day can't be before the receive day.")).toBeInTheDocument();
  });

  it("says so when the day already has a full PPF, and keeps what was typed", async () => {
    serveCalendar([]);
    server.use(http.post("/api/ppf/bookings", () => HttpResponse.json({ statusCode: 409, code: "PPF_DAY_FULL", message: "taken" }, { status: 409 })));
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Add booking" }));
    const dialog = await screen.findByRole("dialog", { name: "New booking" });
    await user.type(within(dialog).getByLabelText("Car"), "Patrol");
    await user.type(within(dialog).getByLabelText("Owner name"), "Hamad");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("A full PPF is already booked on this day.");
    expect(within(dialog).getByLabelText("Car")).toHaveValue("Patrol");
  });

  it("edits a booking, sending cleared fields as empty", async () => {
    let body: Record<string, unknown> = {};
    serveCalendar([booking()]);
    server.use(
      http.patch("/api/ppf/bookings/b-1", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(booking());
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    const card = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    await user.click(within(card).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit booking" });
    expect(within(dialog).getByLabelText("Car")).toHaveValue("Land Cruiser 2024");
    await user.clear(within(dialog).getByLabelText(/Phone/));
    await user.click(within(dialog).getByRole("radio", { name: /Light job/ }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).toMatchObject({ type: "LIGHT", phone: "", car: "Land Cruiser 2024", deliveryDate: "2031-03-13" }));
  });

  it("cancels a booking after confirming; a cancelled one has no actions", async () => {
    const bookings = [booking()];
    serveCalendar(bookings);
    let cancelled = false;
    server.use(
      http.post("/api/ppf/bookings/b-1/cancel", () => {
        cancelled = true;
        bookings[0] = booking({ status: "CANCELLED", cancelledAt: "2031-03-10T09:00:00.000Z" });
        return HttpResponse.json(bookings[0]);
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    const card = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    await user.click(within(card).getByRole("button", { name: "Cancel booking" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Cancel this booking?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancel booking" }));

    await waitFor(() => expect(cancelled).toBe(true));
    await waitFor(() => expect(cell(TODAY)).toHaveAttribute("data-state", "OPEN"));
    const after = screen.getByRole("article", { name: "Land Cruiser 2024" });
    expect(within(after).getByText("Cancelled")).toBeInTheDocument();
    expect(within(after).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("closes a day with a reason and reopens it", async () => {
    const closed: Record<string, string | null> = {};
    serveCalendar([], closed);
    let reason: unknown;
    server.use(
      http.put(`/api/ppf/closed-days/${TODAY}`, async ({ request }) => {
        reason = ((await request.json()) as { reason: string }).reason;
        closed[TODAY] = "National Day";
        return HttpResponse.json({ date: TODAY, reason: "National Day" });
      }),
      http.delete(`/api/ppf/closed-days/${TODAY}`, () => {
        delete closed[TODAY];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Close day" }));
    const dialog = await screen.findByRole("dialog", { name: "Close this day?" });
    await user.type(within(dialog).getByLabelText(/Reason/), "National Day");
    await user.click(within(dialog).getByRole("button", { name: "Close day" }));

    expect(await screen.findByText("Closed: National Day")).toBeInTheDocument();
    expect(reason).toBe("National Day");
    expect(screen.queryByRole("button", { name: "Add booking" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reopen day" }));
    expect(await screen.findByRole("button", { name: "Add booking" })).toBeInTheDocument();
  });

  it("view-only users see the calendar without any buttons that change it", async () => {
    serveCalendar([booking()]);
    renderWithApp(<PpfBookingsPage />, { user: viewer });
    const card = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    for (const name of ["Add booking", "Close day"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("changing month loads that month and selects its first day", async () => {
    const calls = serveCalendar([]);
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Next month" }));
    await waitFor(() => expect(calls.at(-1)).toBe("?from=2031-04-01&to=2031-04-30"));
    expect(screen.getByRole("heading", { name: "April 2031" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- features/bookings/ppf/ppf-bookings-page.test.tsx` → FAIL (`./ppf-bookings-page` not found).

- [ ] **Step 3: The booking form**

Create `features/bookings/ppf/booking-form.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors } from "@/features/admin/shared/forms";
import { useFieldError } from "@/features/admin/shared/ui";
import { api } from "@/lib/api/client";
import type { PpfBooking } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { cn } from "@/lib/utils";
import { BOOKING_NAME_MAX, BOOKING_NOTE_MAX, BOOKING_SERVICE_MAX } from "@/shared/validation";
import { dayField, nameField, optionalDay, optionalPhone, optionalText } from "../shared/schemas";

const TYPES = ["FULL", "LIGHT"] as const;
const FIELDS = ["type", "car", "ownerName", "phone", "service", "receiveDate", "deliveryDate", "note"] as const;

const schema = z
  .object({
    type: z.enum(TYPES),
    car: nameField,
    ownerName: nameField,
    phone: optionalPhone,
    service: optionalText(BOOKING_SERVICE_MAX),
    receiveDate: dayField,
    deliveryDate: optionalDay,
    note: optionalText(BOOKING_NOTE_MAX),
  })
  .refine((v) => v.deliveryDate === "" || v.deliveryDate >= v.receiveDate, { path: ["deliveryDate"], message: "deliveryBeforeReceive" });
type Input_ = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** Add or edit a PPF booking. Empty optional fields are sent as "" — the API reads that as "none". */
export function BookingDialog({
  open,
  onOpenChange,
  booking,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = a new booking on `defaultDate` */
  booking: PpfBooking | null;
  defaultDate: string;
  onSaved: () => void;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("Common.close")} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(booking ? "PpfBookings.editTitle" : "PpfBookings.addTitle")}</DialogTitle>
          <DialogDescription>{t("PpfBookings.subtitle")}</DialogDescription>
        </DialogHeader>
        <BookingForm booking={booking} defaultDate={defaultDate} onCancel={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function BookingForm({ booking, defaultDate, onCancel, onSaved }: { booking: PpfBooking | null; defaultDate: string; onCancel: () => void; onSaved: () => void }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Input_, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: booking?.type ?? "FULL",
      car: booking?.car ?? "",
      ownerName: booking?.ownerName ?? "",
      phone: booking?.phone ?? "",
      service: booking?.service ?? "",
      receiveDate: booking?.receiveDate ?? defaultDate,
      deliveryDate: booking?.deliveryDate ?? "",
      note: booking?.note ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const type = form.watch("type");

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      if (booking) await api(`/ppf/bookings/${booking.id}`, { method: "PATCH", json: values });
      else await api("/ppf/bookings", { method: "POST", json: values });
      toast.success(t("PpfBookings.saved"));
      onSaved();
    } catch (e) {
      const matched = applyFieldErrors(e, FIELDS, (f) => form.setError(f, { message: "invalid" }));
      if (!matched) setError(message(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {error && (
        <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-ink-2">{t("PpfBookings.type")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TYPES.map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-brand)] border-[1.5px] border-line p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
                type === value && "border-ink",
              )}
            >
              <input type="radio" value={value} className="mt-1 accent-[var(--color-accent)]" {...form.register("type")} />
              <span>
                <b className="block text-[15px]">{t(`PpfBookings.types.${value}`)}</b>
                <small className="text-[13px] text-muted">{t(`PpfBookings.typeHints.${value}`)}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t("PpfBookings.car")} hint={t("PpfBookings.carHint")} error={fe(errors.car?.message, { max: BOOKING_NAME_MAX })}>
        <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} autoFocus {...form.register("car")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("PpfBookings.ownerName")} error={fe(errors.ownerName?.message, { max: BOOKING_NAME_MAX })}>
          <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("ownerName")} />
        </Field>
        <Field label={t("PpfBookings.phone")} optional error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="off" dir="ltr" className="text-start" maxLength={20} {...form.register("phone")} />
        </Field>
      </div>
      <Field label={t("PpfBookings.service")} optional error={fe(errors.service?.message, { max: BOOKING_SERVICE_MAX })}>
        <Input autoComplete="off" dir="auto" maxLength={BOOKING_SERVICE_MAX} {...form.register("service")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("PpfBookings.receiveDate")} error={errors.receiveDate?.message}>
          <Input type="date" dir="ltr" {...form.register("receiveDate")} />
        </Field>
        <Field label={t("PpfBookings.deliveryDate")} optional error={errors.deliveryDate?.message}>
          <Input type="date" dir="ltr" {...form.register("deliveryDate")} />
        </Field>
      </div>
      <Field label={t("PpfBookings.note")} optional error={fe(errors.note?.message, { max: BOOKING_NOTE_MAX })}>
        <Textarea dir="auto" rows={3} maxLength={BOOKING_NOTE_MAX} {...form.register("note")} />
      </Field>
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("Common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("Common.saving") : t("Common.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
```

- [ ] **Step 4: The day panel**

Create `features/bookings/ppf/day-panel.tsx`:

```tsx
"use client";

import { Ban, CalendarPlus, LockOpen, Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Pill } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { isolate } from "@/features/admin/shared/ui";
import type { DayInfo, PpfBooking } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { formatDay } from "../shared/dates";

const STATE_TONE = { OPEN: "success", FULL: "danger", CLOSED: "neutral" } as const;

/** The selected day: its state, what the call center can do with it, and its bookings. */
export function DayPanel({
  date,
  info,
  bookings,
  canManage,
  onAdd,
  onEdit,
  onCancel,
  onClose,
  onReopen,
}: {
  date: string;
  info: DayInfo | undefined;
  bookings: PpfBooking[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (booking: PpfBooking) => void;
  onCancel: (booking: PpfBooking) => void;
  onClose: () => void;
  onReopen: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const closed = info?.state === "CLOSED";

  return (
    <section aria-label={formatDay(date, locale)} className="rounded-[var(--radius-brand-lg)] border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg leading-tight font-extrabold">{formatDay(date, locale)}</h2>
        {info && <Pill tone={STATE_TONE[info.state]}>{t(`Calendar.states.${info.state}`)}</Pill>}
      </div>
      {closed && (
        <p className="mt-1 text-[15px] font-semibold text-ink-2">
          {info.reason ? t("PpfBookings.closedBecause", { reason: isolate(info.reason) }) : t("PpfBookings.closedNoReason")}
        </p>
      )}

      {canManage && info && (
        <div className="mt-3 flex flex-wrap gap-2">
          {closed ? (
            <Button variant="outline" onClick={onReopen}>
              <LockOpen aria-hidden="true" />
              {t("PpfBookings.reopen")}
            </Button>
          ) : (
            <>
              <Button onClick={onAdd}>
                <CalendarPlus aria-hidden="true" />
                {t("PpfBookings.add")}
              </Button>
              <Button variant="outline" onClick={onClose}>
                <Ban aria-hidden="true" />
                {t("PpfBookings.closeDay")}
              </Button>
            </>
          )}
        </div>
      )}

      {bookings.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">{t("PpfBookings.noBookings")}</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {bookings.map((b) => {
            const cancelled = b.status === "CANCELLED";
            return (
              <li key={b.id}>
                <article aria-label={b.car} className={cn("rounded-[var(--radius-brand)] border border-line p-3", cancelled && "opacity-60")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={b.type === "FULL" ? "danger" : "warning"}>{t(`PpfBookings.types.${b.type}`)}</Pill>
                    {cancelled && <Pill>{t("PpfBookings.cancelledBadge")}</Pill>}
                  </div>
                  <p dir="auto" className={cn("mt-2 text-[17px] font-extrabold", cancelled && "line-through decoration-1")}>
                    {b.car}
                  </p>
                  <p className="text-[15px] text-ink-2">
                    <span dir="auto">{b.ownerName}</span>
                    {b.phone && (
                      <>
                        {" · "}
                        <a href={`tel:${b.phone.replaceAll(" ", "")}`} dir="ltr" className="font-semibold underline underline-offset-2">
                          {b.phone}
                        </a>
                      </>
                    )}
                  </p>
                  {b.service && (
                    <p dir="auto" className="text-[15px] font-semibold">
                      {b.service}
                    </p>
                  )}
                  {b.deliveryDate && <p className="text-[14px] text-ink-2">{t("PpfBookings.delivery", { date: formatDay(b.deliveryDate, locale, "short") })}</p>}
                  {b.requestedBy && <p className="text-[14px] text-ink-2">{t("PpfBookings.requestedBy", { name: isolate(b.requestedBy) })}</p>}
                  {b.note && (
                    <p dir="auto" className="mt-1 text-[14px] whitespace-pre-line text-ink-2">
                      {b.note}
                    </p>
                  )}
                  {canManage && !cancelled && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(b)}>
                        <Pencil aria-hidden="true" />
                        {t("Common.edit")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onCancel(b)}>
                        {t("PpfBookings.cancelBooking")}
                      </Button>
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 5: The page**

Create `features/bookings/ppf/ppf-bookings-page.tsx`:

```tsx
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { ErrorState, NoAccess } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api/client";
import type { PpfBooking } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { qatarDay } from "@/lib/format";
import { CLOSE_REASON_MAX } from "@/shared/validation";
import { formatDay, monthOf } from "../shared/dates";
import { MonthCalendar } from "../shared/month-calendar";
import { BookingDialog } from "./booking-form";
import { DayPanel } from "./day-panel";
import { fetchCalendar, ppfKeys } from "./queries";

/** The call center's PPF calendar for Bin Omran. */
export function PpfBookingsPage() {
  const t = useTranslations("PpfBookings");
  const { can } = useAuth();
  if (!can("booking.ppf.read")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess permission="booking.ppf.read" />
      </>
    );
  }
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CalendarTab canManage={can("booking.ppf.manage")} />
    </>
  );
}

export function CalendarTab({ canManage }: { canManage: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => monthOf(qatarDay(new Date())));
  const [selected, setSelected] = useState(() => qatarDay(new Date()));
  const [form, setForm] = useState<{ open: boolean; booking: PpfBooking | null }>({ open: false, booking: null });
  const [cancelling, setCancelling] = useState<PpfBooking | null>(null);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");

  const calendar = useQuery({ queryKey: ppfKeys.calendar(month), queryFn: () => fetchCalendar(month) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ppfKeys.all });
  const info = calendar.data?.days.find((d) => d.date === selected);
  const bookings = calendar.data?.bookings.filter((b) => b.receiveDate === selected) ?? [];

  const changeMonth = (next: string) => {
    const today = qatarDay(new Date());
    setMonth(next);
    setSelected(monthOf(today) === next ? today : `${next}-01`);
  };

  /** Runs a change, reports it, and refreshes either way (a refusal usually means the data moved on). */
  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast.success(done);
    } catch (e) {
      toast.error(message(e));
      throw e;
    } finally {
      await refresh();
    }
  };

  if (calendar.isError && !calendar.data) return <ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} />;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <MonthCalendar month={month} days={calendar.data?.days} today={calendar.data?.today} selected={selected} onSelect={setSelected} onMonthChange={changeMonth} />
      <DayPanel
        date={selected}
        info={info}
        bookings={bookings}
        canManage={canManage}
        onAdd={() => setForm({ open: true, booking: null })}
        onEdit={(booking) => setForm({ open: true, booking })}
        onCancel={setCancelling}
        onClose={() => {
          setReason("");
          setClosing(true);
        }}
        onReopen={() => void run(() => api(`/ppf/closed-days/${selected}`, { method: "DELETE" }), t("PpfBookings.dayReopened")).catch(() => undefined)}
      />

      <BookingDialog
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        booking={form.booking}
        defaultDate={selected}
        onSaved={() => {
          setForm((f) => ({ ...f, open: false }));
          void refresh();
        }}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={t("PpfBookings.cancelTitle")}
        body={t("PpfBookings.cancelBody")}
        confirmLabel={t("PpfBookings.cancelBooking")}
        cancelLabel={t("Common.back")}
        destructive
        onConfirm={() => run(() => api(`/ppf/bookings/${cancelling?.id}/cancel`, { method: "POST" }), t("PpfBookings.cancelled"))}
      />

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent closeLabel={t("Common.close")} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("PpfBookings.closeTitle")}</DialogTitle>
            <DialogDescription>
              {formatDay(selected, locale)}. {t("PpfBookings.closeBody")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api(`/ppf/closed-days/${selected}`, { method: "PUT", json: { reason } }), t("PpfBookings.dayClosed"))
                .then(() => setClosing(false))
                .catch(() => undefined);
            }}
          >
            <Field label={t("PpfBookings.reason")} optional>
              <Input dir="auto" autoComplete="off" maxLength={CLOSE_REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setClosing(false)}>
                {t("Common.cancel")}
              </Button>
              <Button type="submit">{t("PpfBookings.closeDay")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Read the Next.js guide for pages first (`node_modules/next/dist/docs/01-app/`), then create `app/[locale]/(app)/(staff)/dashboard/ppf-bookings/page.tsx`, mirroring `dashboard/branches/page.tsx`:

```tsx
import { PpfBookingsPage } from "@/features/bookings/ppf/ppf-bookings-page";

export default function PpfBookings() {
  return <PpfBookingsPage />;
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- features/bookings && npm run typecheck && npm run lint` → PASS.

Two things to check if a test fails rather than changing the test:
- `ConfirmDialog` renders an `alertdialog`; its confirm button carries `confirmLabel`, and the dismiss button carries `cancelLabel` ("Back"), so "Cancel booking" inside the dialog is unambiguous.
- The React Compiler is on in this project: do not add `useMemo`/`useCallback` to make a test pass.

- [ ] **Step 7: Commit**

```bash
git add features/bookings/ppf app
git commit -m "feat(web): PPF bookings page with calendar, day panel and booking form"
```

---

### Task 11: PPF bookings page — requests inbox and the sales-page card

**Files:**
- Create: `features/bookings/ppf/requests-inbox.tsx`, `features/bookings/ppf/sales-access-card.tsx`
- Modify: `features/bookings/ppf/ppf-bookings-page.tsx`
- Create: `features/bookings/ppf/requests-and-sales.test.tsx`

**Interfaces:**
- Consumes: `CalendarTab`, `ppfKeys`, `fetchRequests`, `fetchSalesAccess`, `usePendingRequests`, `pinField`, fixtures from Task 10.
- Produces: `RequestsInbox({ canManage }: { canManage: boolean })`, `SalesAccessCard({ canManage }: { canManage: boolean })`. `PpfBookingsPage` now shows tabs **Calendar** / **Requests** and the sales card under the calendar.

- [ ] **Step 1: Write the failing test**

Create `features/bookings/ppf/requests-and-sales.test.tsx`:

```tsx
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LightJobRequest } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { calendarOf, NOW, page, TODAY, registerPpfDefaults } from "./ppf-fixtures";
import { PpfBookingsPage } from "./ppf-bookings-page";

const amani = makeUser({ role: "RESERVATIONS", branch: null, permissions: ["booking.ppf.read", "booking.ppf.manage"] });
const viewer = makeUser({ role: "FINANCE", branch: null, permissions: ["booking.ppf.read"] });

const request = (over: Partial<LightJobRequest> = {}): LightJobRequest => ({
  id: "r-1",
  date: TODAY,
  salesName: "Yousef",
  car: "Lexus LX",
  ownerName: "Sara Al-Kuwari",
  phone: "55123456",
  note: "Front windows tint",
  status: "PENDING",
  decisionNote: null,
  decidedAt: null,
  bookingId: null,
  createdAt: "2031-03-10T08:00:00.000Z",
  ...over,
});

/** Serves a mutable list for both the inbox and the waiting counter. */
function serveRequests(list: LightJobRequest[]) {
  server.use(
    http.get("/api/ppf/requests", ({ request: req }) => {
      const status = new URL(req.url).searchParams.get("status");
      return HttpResponse.json(page(status ? list.filter((r) => r.status === status) : list));
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  registerPpfDefaults();
  server.use(http.get("/api/ppf/calendar", () => HttpResponse.json(calendarOf([]))));
});
afterEach(() => vi.useRealTimers());

async function openRequests(user: ReturnType<typeof renderWithApp>["user"]) {
  await user.click(await screen.findByRole("tab", { name: /Requests/ }));
}

describe("PPF requests inbox", () => {
  it("shows how many are waiting on the tab, and each request in full", async () => {
    serveRequests([request(), request({ id: "r-2", car: "Tesla Y", status: "REJECTED", decisionNote: "Workshop is full" })]);
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    expect(await screen.findByRole("tab", { name: /Requests.*1 request waiting/ })).toBeInTheDocument();
    await openRequests(user);

    const card = await screen.findByRole("article", { name: "Lexus LX" });
    expect(within(card).getByText("Waiting")).toBeInTheDocument();
    expect(within(card).getByText(/Yousef/)).toBeInTheDocument();
    expect(within(card).getByText("Front windows tint")).toBeInTheDocument();
    expect(within(card).getByText("55123456")).toBeInTheDocument();
    const answered = screen.getByRole("article", { name: "Tesla Y" });
    expect(within(answered).getByText("Rejected")).toBeInTheDocument();
    expect(within(answered).getByText("Workshop is full")).toBeInTheDocument();
    expect(within(answered).queryByRole("button")).not.toBeInTheDocument();
  });

  it("approves a request", async () => {
    const list = [request()];
    serveRequests(list);
    let approved = false;
    server.use(
      http.post("/api/ppf/requests/r-1/approve", () => {
        approved = true;
        list[0] = request({ status: "APPROVED", bookingId: "b-9" });
        return HttpResponse.json(list[0]);
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await openRequests(user);
    const card = await screen.findByRole("article", { name: "Lexus LX" });
    await user.click(within(card).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approved).toBe(true));
    expect(await within(screen.getByRole("article", { name: "Lexus LX" })).findByText("Approved")).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "Requests" })).toBeInTheDocument(); // counter gone
  });

  it("rejects with a reason the salesperson will see", async () => {
    const list = [request()];
    serveRequests(list);
    let body: unknown;
    server.use(
      http.post("/api/ppf/requests/r-1/reject", async ({ request: req }) => {
        body = await req.json();
        list[0] = request({ status: "REJECTED", decisionNote: "Workshop is full" });
        return HttpResponse.json(list[0]);
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await openRequests(user);
    await user.click(within(await screen.findByRole("article", { name: "Lexus LX" })).getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject this request?" });
    await user.type(within(dialog).getByLabelText(/Reason/), "Workshop is full");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(body).toEqual({ decisionNote: "Workshop is full" }));
    expect(await screen.findByText("Workshop is full")).toBeInTheDocument();
  });

  it("when someone else already answered, says so and shows the real state", async () => {
    const list = [request()];
    serveRequests(list);
    server.use(
      http.post("/api/ppf/requests/r-1/approve", () => {
        list[0] = request({ status: "REJECTED", decisionNote: "Answered in another tab" });
        return HttpResponse.json({ statusCode: 409, code: "REQUEST_ALREADY_DECIDED", message: "x" }, { status: 409 });
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await openRequests(user);
    await user.click(within(await screen.findByRole("article", { name: "Lexus LX" })).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("This request was already answered.")).toBeInTheDocument();
    expect(await screen.findByText("Answered in another tab")).toBeInTheDocument();
  });

  it("view-only users can read requests but not answer them", async () => {
    serveRequests([request()]);
    const { user } = renderWithApp(<PpfBookingsPage />, { user: viewer });
    await openRequests(user);
    expect(within(await screen.findByRole("article", { name: "Lexus LX" })).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Sales page card", () => {
  it("shows the link and that no PIN is set, then sets one", async () => {
    let body: unknown;
    let pinSet = false;
    server.use(
      http.get("/api/ppf/sales-access", () => HttpResponse.json({ pinSet, updatedAt: pinSet ? "2031-03-10T09:00:00.000Z" : null })),
      http.put("/api/ppf/sales-access/pin", async ({ request: req }) => {
        body = await req.json();
        pinSet = true;
        return HttpResponse.json({ pinSet: true, updatedAt: "2031-03-10T09:00:00.000Z" });
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    const card = await screen.findByRole("region", { name: "Sales page" });
    expect(await within(card).findByText(/No PIN yet/)).toBeInTheDocument();
    expect(within(card).getByText("http://localhost:3000/en/slots")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Set PIN" }));
    const dialog = await screen.findByRole("dialog", { name: "Sales PIN" });
    await user.type(within(dialog).getByLabelText("PIN"), "12345");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Enter 6 digits.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Generate" }));
    const pin = (within(dialog).getByLabelText("PIN") as HTMLInputElement).value;
    expect(pin).toMatch(/^\d{6}$/);
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).toEqual({ pin }));
    expect(await within(card).findByText("A PIN is set.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Change PIN" })).toBeInTheDocument();
  });

  it("view-only users see the link but cannot change the PIN", async () => {
    renderWithApp(<PpfBookingsPage />, { user: viewer });
    const card = await screen.findByRole("region", { name: "Sales page" });
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- features/bookings/ppf/requests-and-sales.test.tsx` → FAIL (no "Requests" tab).

- [ ] **Step 3: The inbox**

Create `features/bookings/ppf/requests-inbox.tsx`:

```tsx
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/app/badges";
import { Field } from "@/components/app/field";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isolate } from "@/features/admin/shared/ui";
import { api } from "@/lib/api/client";
import type { LightJobRequest, RequestStatus } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { formatDateTime } from "@/lib/format";
import { DECISION_NOTE_MAX } from "@/shared/validation";
import { formatDay } from "../shared/dates";
import { fetchRequests, ppfKeys } from "./queries";

const TONE: Record<RequestStatus, "warning" | "success" | "neutral"> = { PENDING: "warning", APPROVED: "success", REJECTED: "neutral" };

/** Light-job requests from the sales page, newest first. */
export function RequestsInbox({ canManage }: { canManage: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ppfKeys.requests, queryFn: fetchRequests, refetchInterval: 60_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<LightJobRequest | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** A refusal (already answered, day closed) also refreshes, so the list shows what really happened. */
  const decide = async (request: LightJobRequest, verb: "approve" | "reject", json: Record<string, string>) => {
    setBusy(request.id);
    setError(null);
    try {
      await api(`/ppf/requests/${request.id}/${verb}`, { method: "POST", json });
      toast.success(t(verb === "approve" ? "PpfBookings.approved" : "PpfBookings.rejected"));
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      await queryClient.invalidateQueries({ queryKey: ppfKeys.all });
      setBusy(null);
    }
  };

  if (requests.isPending) return <LoadingRows rows={3} className="h-28" />;
  if (requests.isError) return <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />;
  if (requests.data.items.length === 0) return <EmptyState title={t("PpfBookings.requestsEmpty")} />;

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      <ul className="grid gap-3 lg:grid-cols-2">
        {requests.data.items.map((r) => (
          <li key={r.id}>
            <article aria-label={r.car} className="h-full rounded-[var(--radius-brand)] border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Pill tone={TONE[r.status]}>{t(`PpfBookings.requestStatus.${r.status}`)}</Pill>
                <time dateTime={r.createdAt} className="text-[13px] text-muted">
                  {formatDateTime(r.createdAt, locale)}
                </time>
              </div>
              <p dir="auto" className="mt-2 text-[17px] font-extrabold">
                {r.car}
              </p>
              <p className="text-[14px] font-semibold text-ink-2">
                {t("PpfBookings.requestFor", { name: isolate(r.salesName), date: formatDay(r.date, locale, "short") })}
              </p>
              <p className="mt-1 text-[15px] text-ink-2">
                <span dir="auto">{r.ownerName}</span>
                {r.phone && (
                  <>
                    {" · "}
                    <span dir="ltr">{r.phone}</span>
                  </>
                )}
              </p>
              <p dir="auto" className="mt-1 text-[15px] whitespace-pre-line">
                {r.note}
              </p>
              {r.decisionNote && (
                <p dir="auto" className="mt-2 rounded-[8px] bg-sand px-2.5 py-1.5 text-[14px] text-ink-2">
                  {r.decisionNote}
                </p>
              )}
              {canManage && r.status === "PENDING" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy === r.id} onClick={() => void decide(r, "approve", {})}>
                    <Check aria-hidden="true" />
                    {t("PpfBookings.approve")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => {
                      setReason("");
                      setRejecting(r);
                    }}
                  >
                    <X aria-hidden="true" />
                    {t("PpfBookings.reject")}
                  </Button>
                </div>
              )}
            </article>
          </li>
        ))}
      </ul>

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent closeLabel={t("Common.close")} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("PpfBookings.rejectTitle")}</DialogTitle>
            <DialogDescription dir="auto">{rejecting?.car}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!rejecting) return;
              void decide(rejecting, "reject", { decisionNote: reason }).then(() => setRejecting(null));
            }}
          >
            <Field label={t("PpfBookings.rejectReason")} optional>
              <Textarea dir="auto" rows={3} maxLength={DECISION_NOTE_MAX} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
                {t("Common.cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={busy !== null}>
                {t("PpfBookings.reject")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 4: The sales-page card**

Create `features/bookings/ppf/sales-access-card.tsx`:

```tsx
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Shuffle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { pinField } from "../shared/schemas";
import { fetchSalesAccess, ppfKeys } from "./queries";

const randomPin = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");

/** The link salespeople open, and the shared PIN that protects it. The PIN is shown only while it is being set. */
export function SalesAccessCard({ canManage }: { canManage: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const titleId = useId();
  const access = useQuery({ queryKey: ppfKeys.salesAccess, queryFn: fetchSalesAccess });
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/${locale}/slots`;

  const save = async () => {
    const parsed = pinField.safeParse(pin);
    if (!parsed.success) return setError("pin");
    setSaving(true);
    try {
      await api("/ppf/sales-access/pin", { method: "PUT", json: { pin: parsed.data } });
      toast.success(t("PpfBookings.pinSaved"));
      await queryClient.invalidateQueries({ queryKey: ppfKeys.salesAccess });
      setOpen(false);
    } catch (e) {
      toast.error(message(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={titleId} className="mt-8 rounded-[var(--radius-brand-lg)] border border-line p-4">
      <h2 id={titleId} className="text-lg font-extrabold">
        {t("PpfBookings.salesTitle")}
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">{t("PpfBookings.salesHint")}</p>
      <p dir="ltr" className="mt-3 rounded-[8px] bg-sand px-3 py-2 text-start font-mono text-[14px] break-all select-all">
        {link}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {access.data && <p className="text-[15px] font-semibold">{t(access.data.pinSet ? "PpfBookings.pinSet" : "PpfBookings.pinNotSet")}</p>}
        {canManage && access.data && (
          <Button
            variant="outline"
            onClick={() => {
              setPin("");
              setError(undefined);
              setOpen(true);
            }}
          >
            <KeyRound aria-hidden="true" />
            {t(access.data.pinSet ? "PpfBookings.changePin" : "PpfBookings.setPin")}
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("Common.close")} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("PpfBookings.pinTitle")}</DialogTitle>
            <DialogDescription>{t("PpfBookings.pinBody")}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Field label={t("PpfBookings.pin")} error={error}>
              <Input
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                maxLength={6}
                className="text-center font-mono text-2xl tracking-[0.3em]"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(undefined);
                }}
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPin(randomPin());
                  setError(undefined);
                }}
              >
                <Shuffle aria-hidden="true" />
                {t("PpfBookings.generate")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("Common.saving") : t("Common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
```

- [ ] **Step 5: Tabs on the page**

In `features/bookings/ppf/ppf-bookings-page.tsx`, add the imports:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchCalendar, ppfKeys, usePendingRequests } from "./queries";
import { RequestsInbox } from "./requests-inbox";
import { SalesAccessCard } from "./sales-access-card";
```

(merge the `./queries` import with the existing one) and replace the final `return` of `PpfBookingsPage` with:

```tsx
  return <PpfManager canManage={can("booking.ppf.manage")} />;
}

function PpfManager({ canManage }: { canManage: boolean }) {
  const t = useTranslations("PpfBookings");
  const pending = usePendingRequests(true);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Tabs defaultValue="calendar">
        <TabsList className="mb-5">
          <TabsTrigger value="calendar">{t("tabCalendar")}</TabsTrigger>
          <TabsTrigger value="requests">
            {t("tabRequests")}
            {pending > 0 && (
              <span className="ms-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[12px] font-extrabold text-white tabular-nums">
                <span aria-hidden="true">{pending}</span>
                <span className="sr-only">{t("pending", { count: pending })}</span>
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calendar">
          <CalendarTab canManage={canManage} />
          <SalesAccessCard canManage={canManage} />
        </TabsContent>
        <TabsContent value="requests">
          <RequestsInbox canManage={canManage} />
        </TabsContent>
      </Tabs>
    </>
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- features/bookings features/dashboard && npm run typecheck && npm run lint` → PASS (Task 10's tests included: they already register the requests and sales-access handlers).

- [ ] **Step 7: Commit**

```bash
git add features/bookings/ppf
git commit -m "feat(web): light-job requests inbox and sales PIN card"
```

---

### Task 12: General reservations page

**Files:**
- Create: `features/bookings/general/reservation-form.tsx`, `features/bookings/general/reservations-page.tsx`, `features/bookings/general/reservations-page.test.tsx`
- Create: `app/[locale]/(app)/(staff)/dashboard/reservations/page.tsx`

**Interfaces:**
- Consumes: `GeneralReservation`, `Page` (types); `schemas.ts`, `formatDay` (Tasks 8–9); `api`, `useAuth`, `PageHeader`, `NoAccess`, `EmptyState`, `ErrorState`, `LoadingRows`, `ConfirmDialog`, `Field`, `Pill`, `Checkbox`, `qatarDay`.
- Produces: `ReservationsPage()`; `ReservationDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; reservation: GeneralReservation | null; defaultDate: string; onSaved: () => void })`. Query key prefix `["reservations"]`.

- [ ] **Step 1: Write the failing test**

Create `features/bookings/general/reservations-page.test.tsx`:

```tsx
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneralReservation } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { ReservationsPage } from "./reservations-page";

const amani = makeUser({ role: "RESERVATIONS", branch: null, permissions: ["booking.general.manage"] });
const NOW = new Date("2031-03-10T09:00:00.000Z");

const reservation = (over: Partial<GeneralReservation> = {}): GeneralReservation => ({
  id: "g-1",
  date: "2031-03-10",
  time: "16:30",
  service: "Ceramic coating",
  ownerName: "Sara Al-Kuwari",
  phone: "55123456",
  car: "Lexus LX",
  note: null,
  status: "BOOKED",
  createdBy: { id: "u-1", displayName: "Amani" },
  createdAt: "2031-03-01T08:00:00.000Z",
  cancelledAt: null,
  ...over,
});

/** Serves a mutable list and records every query string the page sends. */
function serve(list: GeneralReservation[]) {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get("/api/reservations", ({ request }) => {
      calls.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items: list, page: 1, pageSize: 100, total: list.length });
    }),
  );
  return calls;
}

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: NOW }));
afterEach(() => vi.useRealTimers());

describe("General reservations page", () => {
  it("needs booking.general.manage", () => {
    renderWithApp(<ReservationsPage />, { user: makeUser({ permissions: ["booking.ppf.read"] }) });
    expect(screen.getByRole("alert")).toHaveTextContent("Manage general reservations");
  });

  it("lists from today, active only, grouped by day", async () => {
    const calls = serve([reservation(), reservation({ id: "g-2", date: "2031-03-12", time: null, service: "Polish", ownerName: null, phone: null, car: null })]);
    renderWithApp(<ReservationsPage />, { user: amani });

    const first = await screen.findByRole("article", { name: "Ceramic coating" });
    expect(Object.fromEntries(calls[0])).toEqual({ from: "2031-03-10", status: "BOOKED", pageSize: "100" });
    expect(within(first).getByText("16:30")).toBeInTheDocument();
    expect(within(first).getByText(/Sara Al-Kuwari/)).toBeInTheDocument();
    expect(within(first).getByText("Lexus LX")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getByRole("article", { name: "Polish" })).toBeInTheDocument();
  });

  it("adds a reservation with only a day and a service", async () => {
    const list: GeneralReservation[] = [];
    serve(list);
    let body: unknown;
    server.use(
      http.post("/api/reservations", async ({ request }) => {
        body = await request.json();
        list.push(reservation({ id: "g-9", service: "Seat covers", time: null, ownerName: null, phone: null, car: null }));
        return HttpResponse.json(list[0], { status: 201 });
      }),
    );
    const { user } = renderWithApp(<ReservationsPage />, { user: amani });
    await screen.findByText("No reservations in this range.");
    await user.click(screen.getByRole("button", { name: "Add reservation" }));
    const dialog = await screen.findByRole("dialog", { name: "New reservation" });
    expect(within(dialog).getByLabelText("Day")).toHaveValue("2031-03-10");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("This field is required.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Service"), "Seat covers");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(body).toEqual({ date: "2031-03-10", time: "", service: "Seat covers", ownerName: "", phone: "", car: "", note: "" });
    expect(await screen.findByRole("article", { name: "Seat covers" })).toBeInTheDocument();
  });

  it("edits a reservation: clears the hour and moves the day", async () => {
    serve([reservation()]);
    let body: Record<string, unknown> = {};
    server.use(
      http.patch("/api/reservations/g-1", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(reservation());
      }),
    );
    const { user } = renderWithApp(<ReservationsPage />, { user: amani });
    await user.click(within(await screen.findByRole("article", { name: "Ceramic coating" })).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit reservation" });
    fireEvent.change(within(dialog).getByLabelText(/Hour/), { target: { value: "" } });
    fireEvent.change(within(dialog).getByLabelText("Day"), { target: { value: "2031-03-11" } });
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).toMatchObject({ time: "", date: "2031-03-11", service: "Ceramic coating", ownerName: "Sara Al-Kuwari" }));
  });

  it("cancels after confirming", async () => {
    const list = [reservation()];
    serve(list);
    let cancelled = false;
    server.use(
      http.post("/api/reservations/g-1/cancel", () => {
        cancelled = true;
        list.length = 0;
        return HttpResponse.json(reservation({ status: "CANCELLED" }));
      }),
    );
    const { user } = renderWithApp(<ReservationsPage />, { user: amani });
    await user.click(within(await screen.findByRole("article", { name: "Ceramic coating" })).getByRole("button", { name: "Cancel reservation" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Cancel this reservation?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancel reservation" }));
    await waitFor(() => expect(cancelled).toBe(true));
    expect(await screen.findByText("No reservations in this range.")).toBeInTheDocument();
  });

  it("searches, changes the range and can include cancelled ones", async () => {
    const calls = serve([reservation({ status: "CANCELLED", cancelledAt: "2031-03-09T08:00:00.000Z" })]);
    const { user } = renderWithApp(<ReservationsPage />, { user: amani });
    const card = await screen.findByRole("article", { name: "Ceramic coating" });
    expect(within(card).getByText("Cancelled")).toBeInTheDocument();
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search name, phone, car or service" }), "lexus");
    await waitFor(() => expect(calls.at(-1)?.get("q")).toBe("lexus"));
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2031-03-31" } });
    await waitFor(() => expect(calls.at(-1)?.get("to")).toBe("2031-03-31"));
    await user.click(screen.getByRole("checkbox", { name: "Show cancelled" }));
    await waitFor(() => expect(calls.at(-1)?.has("status")).toBe(false));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- features/bookings/general` → FAIL (module not found).

- [ ] **Step 3: The form**

Create `features/bookings/general/reservation-form.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors } from "@/features/admin/shared/forms";
import { useFieldError } from "@/features/admin/shared/ui";
import { api } from "@/lib/api/client";
import type { GeneralReservation } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { BOOKING_NAME_MAX, BOOKING_NOTE_MAX, BOOKING_SERVICE_MAX } from "@/shared/validation";
import { dayField, optionalName, optionalPhone, optionalText, optionalTime, requiredText } from "../shared/schemas";

const FIELDS = ["date", "time", "service", "ownerName", "phone", "car", "note"] as const;

const schema = z.object({
  date: dayField,
  time: optionalTime,
  service: requiredText(BOOKING_SERVICE_MAX),
  ownerName: optionalName,
  phone: optionalPhone,
  car: optionalName,
  note: optionalText(BOOKING_NOTE_MAX),
});
type Input_ = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** Add or edit a general reservation. Empty optional fields are sent as "" — the API reads that as "none". */
export function ReservationDialog({
  open,
  onOpenChange,
  reservation,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = a new reservation on `defaultDate` */
  reservation: GeneralReservation | null;
  defaultDate: string;
  onSaved: () => void;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("Common.close")} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(reservation ? "Reservations.editTitle" : "Reservations.addTitle")}</DialogTitle>
          <DialogDescription>{t("Reservations.subtitle")}</DialogDescription>
        </DialogHeader>
        <ReservationForm reservation={reservation} defaultDate={defaultDate} onCancel={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function ReservationForm({
  reservation,
  defaultDate,
  onCancel,
  onSaved,
}: {
  reservation: GeneralReservation | null;
  defaultDate: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Input_, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: reservation?.date ?? defaultDate,
      time: reservation?.time ?? "",
      service: reservation?.service ?? "",
      ownerName: reservation?.ownerName ?? "",
      phone: reservation?.phone ?? "",
      car: reservation?.car ?? "",
      note: reservation?.note ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      if (reservation) await api(`/reservations/${reservation.id}`, { method: "PATCH", json: values });
      else await api("/reservations", { method: "POST", json: values });
      toast.success(t("Reservations.saved"));
      onSaved();
    } catch (e) {
      const matched = applyFieldErrors(e, FIELDS, (f) => form.setError(f, { message: "invalid" }));
      if (!matched) setError(message(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {error && (
        <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Reservations.date")} error={errors.date?.message}>
          <Input type="date" dir="ltr" {...form.register("date")} />
        </Field>
        <Field label={t("Reservations.time")} optional error={errors.time?.message}>
          <Input type="time" dir="ltr" {...form.register("time")} />
        </Field>
      </div>
      <Field label={t("Reservations.service")} error={fe(errors.service?.message, { max: BOOKING_SERVICE_MAX })}>
        <Input autoComplete="off" dir="auto" maxLength={BOOKING_SERVICE_MAX} autoFocus {...form.register("service")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Reservations.ownerName")} optional error={fe(errors.ownerName?.message, { max: BOOKING_NAME_MAX })}>
          <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("ownerName")} />
        </Field>
        <Field label={t("Reservations.phone")} optional error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="off" dir="ltr" className="text-start" maxLength={20} {...form.register("phone")} />
        </Field>
      </div>
      <Field label={t("Reservations.car")} optional error={fe(errors.car?.message, { max: BOOKING_NAME_MAX })}>
        <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("car")} />
      </Field>
      <Field label={t("Reservations.note")} optional error={fe(errors.note?.message, { max: BOOKING_NOTE_MAX })}>
        <Textarea dir="auto" rows={3} maxLength={BOOKING_NOTE_MAX} {...form.register("note")} />
      </Field>
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("Common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("Common.saving") : t("Common.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
```

- [ ] **Step 4: The page**

Create `features/bookings/general/reservations-page.tsx`:

```tsx
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/app/badges";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, ErrorState, LoadingRows, NoAccess } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api/client";
import type { GeneralReservation, Page } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { qatarDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatDay } from "../shared/dates";
import { ReservationDialog } from "./reservation-form";

/** The call center's private list of every reservation that is not a PPF booking. */
export function ReservationsPage() {
  const t = useTranslations("Reservations");
  const { can } = useAuth();
  if (!can("booking.general.manage")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess permission="booking.general.manage" />
      </>
    );
  }
  return <ReservationsManager />;
}

function ReservationsManager() {
  const t = useTranslations();
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(() => qatarDay(new Date()));
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [form, setForm] = useState<{ open: boolean; reservation: GeneralReservation | null }>({ open: false, reservation: null });
  const [cancelling, setCancelling] = useState<GeneralReservation | null>(null);

  // the list follows the search box a moment after typing stops
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const filters = { from, to, q, status: showCancelled ? "" : "BOOKED" };
  const list = useQuery({
    queryKey: ["reservations", filters],
    queryFn: () => api<Page<GeneralReservation>>("/reservations", { query: { ...filters, pageSize: 100 } }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["reservations"] });

  const groups: { date: string; items: GeneralReservation[] }[] = [];
  for (const r of list.data?.items ?? []) {
    const last = groups.at(-1);
    if (last?.date === r.date) last.items.push(r);
    else groups.push({ date: r.date, items: [r] });
  }

  return (
    <>
      <PageHeader
        title={t("Reservations.title")}
        subtitle={t("Reservations.subtitle")}
        actions={
          <Button onClick={() => setForm({ open: true, reservation: null })}>
            <Plus aria-hidden="true" />
            {t("Reservations.add")}
          </Button>
        }
      />

      <div className="mb-5 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
        <Input
          type="search"
          dir="auto"
          aria-label={t("Reservations.search")}
          placeholder={t("Reservations.search")}
          value={search}
          maxLength={80}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Field label={t("Common.dateFrom")}>
          <Input type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("Common.dateTo")}>
          <Input type="date" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px] font-semibold">
          <Checkbox checked={showCancelled} onCheckedChange={(v) => setShowCancelled(v === true)} />
          {t("Reservations.showCancelled")}
        </label>
      </div>

      {list.isPending ? (
        <LoadingRows rows={4} className="h-24" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState title={t("Reservations.empty")} />
      ) : (
        <div className="grid gap-6">
          {groups.map((group) => (
            <section key={group.date}>
              <h2 className="mb-2 text-[17px] font-extrabold">{formatDay(group.date, locale)}</h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {group.items.map((r) => {
                  const cancelled = r.status === "CANCELLED";
                  return (
                    <li key={r.id}>
                      <article aria-label={r.service} className={cn("h-full rounded-[var(--radius-brand)] border border-line p-4", cancelled && "opacity-60")}>
                        <div className="flex flex-wrap items-center gap-2">
                          {r.time && (
                            <span dir="ltr" className="text-[15px] font-extrabold tabular-nums">
                              {r.time}
                            </span>
                          )}
                          {cancelled && <Pill>{t("Reservations.cancelledBadge")}</Pill>}
                        </div>
                        <p dir="auto" className={cn("text-[17px] font-extrabold", cancelled && "line-through decoration-1")}>
                          {r.service}
                        </p>
                        {(r.ownerName || r.phone) && (
                          <p className="text-[15px] text-ink-2">
                            {r.ownerName && <span dir="auto">{r.ownerName}</span>}
                            {r.ownerName && r.phone && " · "}
                            {r.phone && <span dir="ltr">{r.phone}</span>}
                          </p>
                        )}
                        {r.car && (
                          <p dir="auto" className="text-[15px] font-semibold">
                            {r.car}
                          </p>
                        )}
                        {r.note && (
                          <p dir="auto" className="mt-1 text-[14px] whitespace-pre-line text-ink-2">
                            {r.note}
                          </p>
                        )}
                        {!cancelled && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => setForm({ open: true, reservation: r })}>
                              <Pencil aria-hidden="true" />
                              {t("Common.edit")}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCancelling(r)}>
                              {t("Reservations.cancel")}
                            </Button>
                          </div>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ReservationDialog
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        reservation={form.reservation}
        defaultDate={from || qatarDay(new Date())}
        onSaved={() => {
          setForm((f) => ({ ...f, open: false }));
          void refresh();
        }}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={t("Reservations.cancelTitle")}
        body={t("Reservations.cancelBody")}
        confirmLabel={t("Reservations.cancel")}
        cancelLabel={t("Common.back")}
        destructive
        onConfirm={async () => {
          try {
            await api(`/reservations/${cancelling?.id}/cancel`, { method: "POST" });
            toast.success(t("Reservations.cancelled"));
          } catch (e) {
            toast.error(message(e));
            throw e;
          } finally {
            await refresh();
          }
        }}
      />
    </>
  );
}
```

Create `app/[locale]/(app)/(staff)/dashboard/reservations/page.tsx`:

```tsx
import { ReservationsPage } from "@/features/bookings/general/reservations-page";

export default function Reservations() {
  return <ReservationsPage />;
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- features/bookings/general && npm run typecheck && npm run lint` → PASS.

If the lint rule for effects objects to the debounce `useEffect`, look at how `features/orders/debounced-input.tsx` debounces and reuse that component for the search box instead (keep `aria-label`, `type="search"` and the 300 ms delay).

- [ ] **Step 6: Commit**

```bash
git add features/bookings/general app
git commit -m "feat(web): general reservations page"
```

---

### Task 13: Sales slots page

**Files:**
- Create: `features/bookings/slots/api.ts`, `pin-screen.tsx`, `request-form.tsx`, `side-panel.tsx`, `slots-page.tsx`, `slots-page.test.tsx`
- Create: `app/[locale]/(app)/slots/page.tsx`

**Interfaces:**
- Consumes: `SlotsView`, `SalesBooking`, `SalesRequest`, `DayInfo` (types); `MonthCalendar`, `dates.ts`, `schemas.ts`; `ApiError`, `buildQuery`, `toApiError` (`lib/api/client.ts`); `AuthCard`, `BrandMark`, `LocaleSwitcher`, `ThemeToggle`, `Sheet*`, `Pill`, `Field`, `useWideLayout`, `isolate`, `useErrorMessage`, `qatarDay`.
- Produces: `SlotsPage()`; `slotsApi<T>(path: string, options?: { method?: "GET" | "POST"; json?: unknown; query?: Record<string, string> }): Promise<T>`; `hasSlotsHint(): boolean`. Query key prefix `["slots"]`. The salesperson's name is remembered in `localStorage` under `wc_sales_name`.

- [ ] **Step 1: Write the failing test**

Create `features/bookings/slots/slots-page.test.tsx`:

```tsx
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayInfo, SlotsView } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { renderWithApp } from "@/tests/render";
import { SlotsPage } from "./slots-page";

const NOW = new Date("2031-03-10T09:00:00.000Z");
const TODAY = "2031-03-10";
const cell = (date: string) => document.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)!;

function view(over: Partial<SlotsView> = {}): SlotsView {
  const state: Record<string, Partial<DayInfo>> = {
    "2031-03-12": { state: "FULL", lightCount: 1 },
    "2031-03-14": { state: "CLOSED", reason: "National Day" },
    "2031-03-05": { state: "FULL" },
  };
  return {
    today: TODAY,
    days: Array.from({ length: 31 }, (_, i) => {
      const date = `2031-03-${String(i + 1).padStart(2, "0")}`;
      return { date, state: "OPEN", reason: null, lightCount: 0, ...state[date] };
    }),
    bookings: [
      { id: "b-1", type: "FULL", car: "Land Cruiser 2024", ownerName: "Khalid Al-Marri", phone: "55123456", receiveDate: "2031-03-12", deliveryDate: "2031-03-15" },
      { id: "b-2", type: "LIGHT", car: "Tesla Y", ownerName: "Noor", phone: null, receiveDate: "2031-03-12", deliveryDate: null },
    ],
    requests: [
      { id: "r-1", date: "2031-03-12", salesName: "Yousef", car: "Lexus LX", status: "REJECTED", decisionNote: "Workshop is full", createdAt: "2031-03-09T08:00:00.000Z" },
    ],
    ...over,
  };
}

const unlockPhone = () => {
  document.cookie = "wc_slots=1; path=/";
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  document.cookie = "wc_slots=; path=/; max-age=0";
});

describe("Sales slots page", () => {
  it("asks for the PIN on a new phone and opens with the right one", async () => {
    const pins: unknown[] = [];
    server.use(
      http.post("/api/slots/unlock", async ({ request }) => {
        const { pin } = (await request.json()) as { pin: string };
        pins.push(pin);
        if (pin !== "482915") return HttpResponse.json({ statusCode: 401, code: "SALES_PIN_INVALID", message: "x" }, { status: 401 });
        return HttpResponse.json({ expiresAt: "2031-06-08T09:00:00.000Z" });
      }),
      http.get("/api/slots", () => HttpResponse.json(view())),
    );
    const { user } = renderWithApp(<SlotsPage />, { user: null });

    const pin = await screen.findByLabelText("PIN");
    expect(screen.getByText(/Enter the PIN from the call center/)).toBeInTheDocument();
    await user.type(pin, "123");
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByText("Enter 6 digits.")).toBeInTheDocument();
    expect(pins).toEqual([]);

    await user.clear(pin);
    await user.type(pin, "000000");
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong PIN.");
    expect(pin).toHaveValue("");

    await user.type(pin, "٤٨٢٩١٥");
    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    expect(pins).toEqual(["000000", "482915"]);
  });

  it("tells the salesperson how long the PIN is locked", async () => {
    server.use(
      http.post("/api/slots/unlock", () =>
        HttpResponse.json({ statusCode: 423, code: "SALES_PIN_LOCKED", message: "x", retryAfterSeconds: 840 }, { status: 423 }),
      ),
    );
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await user.type(await screen.findByLabelText("PIN"), "482915");
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many wrong PINs. Try again in 14 min.");
  });

  it("opens straight away on a remembered phone and shows each kind of day", async () => {
    unlockPhone();
    let query = "";
    server.use(
      http.get("/api/slots", ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(view());
      }),
    );
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    expect(query).toBe("?from=2031-03-01&to=2031-03-31");
    expect(screen.queryByLabelText("PIN")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();

    await user.click(cell("2031-03-11"));
    const day = screen.getByRole("region", { name: /11/ });
    expect(within(day).getByText("This day is open. Call the call center to book it.")).toBeInTheDocument();
    expect(within(day).queryByRole("button")).not.toBeInTheDocument();

    await user.click(cell("2031-03-12"));
    const full = screen.getByRole("region", { name: /12/ });
    expect(within(full).getByText("Closed: a full PPF car is booked.")).toBeInTheDocument();
    expect(within(full).getByText("Land Cruiser 2024")).toBeInTheDocument();
    expect(within(full).getByRole("button", { name: "Request a light job" })).toBeInTheDocument();

    await user.click(cell("2031-03-14"));
    const closed = screen.getByRole("region", { name: /14/ });
    expect(within(closed).getByText("Closed by the call center.")).toBeInTheDocument();
    expect(within(closed).getByText("National Day")).toBeInTheDocument();
    expect(within(closed).queryByRole("button")).not.toBeInTheDocument();

    // a full day that is already past takes no request
    await user.click(cell("2031-03-05"));
    expect(within(screen.getByRole("region", { name: /5/ })).queryByRole("button")).not.toBeInTheDocument();
  });

  it("sends a light-job request and remembers the salesperson's name", async () => {
    unlockPhone();
    const bodies: unknown[] = [];
    server.use(
      http.get("/api/slots", () => HttpResponse.json(view())),
      http.post("/api/slots/requests", async ({ request }) => {
        expect(request.headers.get("x-requested-with")).toBe("wolfcar");
        bodies.push(await request.json());
        return HttpResponse.json({ id: "r-2", date: "2031-03-12", salesName: "Yousef", car: "Lexus LX", status: "PENDING", decisionNote: null, createdAt: NOW.toISOString() }, { status: 201 });
      }),
    );
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    await user.click(screen.getByRole("button", { name: "Request a light job" }));

    const dialog = await screen.findByRole("dialog", { name: "Request a light job" });
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(await within(dialog).findAllByText("This field is required.")).toHaveLength(4);

    await user.type(within(dialog).getByLabelText("Your name"), "Yousef");
    await user.type(within(dialog).getByLabelText("Car"), "Lexus LX");
    await user.type(within(dialog).getByLabelText("Owner name"), "Sara Al-Kuwari");
    await user.type(within(dialog).getByLabelText("What is the job?"), "Front windows tint");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(bodies).toEqual([{ date: "2031-03-12", salesName: "Yousef", car: "Lexus LX", ownerName: "Sara Al-Kuwari", phone: "", note: "Front windows tint" }]);

    await user.click(screen.getByRole("button", { name: "Request a light job" }));
    expect(within(await screen.findByRole("dialog")).getByLabelText("Your name")).toHaveValue("Yousef");
  });

  it("explains a refused request inside the form", async () => {
    unlockPhone();
    server.use(
      http.get("/api/slots", () => HttpResponse.json(view())),
      http.post("/api/slots/requests", () => HttpResponse.json({ statusCode: 409, code: "PPF_DAY_NOT_FULL", message: "x" }, { status: 409 })),
    );
    localStorage.setItem("wc_sales_name", "Yousef");
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    await user.click(screen.getByRole("button", { name: "Request a light job" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Car"), "Lexus LX");
    await user.type(within(dialog).getByLabelText("Owner name"), "Sara");
    await user.type(within(dialog).getByLabelText("What is the job?"), "Tint");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Requests are only for days closed by a full PPF.");
  });

  it("the side panel opens and closes, listing booked cars and requests", async () => {
    unlockPhone();
    server.use(http.get("/api/slots", () => HttpResponse.json(view())));
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    expect(screen.queryByRole("article", { name: "Land Cruiser 2024" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show booked cars" }));
    const car = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    expect(within(car).getByText("Full PPF")).toBeInTheDocument();
    expect(within(car).getByText(/Khalid Al-Marri/)).toBeInTheDocument();
    expect(within(car).getByRole("link", { name: "55123456" })).toHaveAttribute("href", "tel:55123456");
    expect(within(car).getByText(/Receive:/)).toBeInTheDocument();
    expect(within(car).getByText(/Delivery:/)).toBeInTheDocument();
    const light = screen.getByRole("article", { name: "Tesla Y" });
    expect(within(light).getByText("Delivery not set")).toBeInTheDocument();

    const request = screen.getByRole("article", { name: "Lexus LX" });
    expect(within(request).getByText("Rejected")).toBeInTheDocument();
    expect(within(request).getByText("Workshop is full")).toBeInTheDocument();
  });

  it("goes back to the PIN screen when the PIN was changed, leaving no customer data on screen", async () => {
    unlockPhone();
    let allowed = true;
    server.use(
      http.get("/api/slots", () =>
        allowed
          ? HttpResponse.json(view())
          : HttpResponse.json({ statusCode: 401, code: "SALES_ACCESS_REQUIRED", message: "x" }, { status: 401 }),
      ),
    );
    const { user, queryClient } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    expect(screen.getByText("Land Cruiser 2024")).toBeInTheDocument();

    allowed = false;
    await queryClient.invalidateQueries({ queryKey: ["slots"] });
    expect(await screen.findByLabelText("PIN")).toBeInTheDocument();
    expect(screen.queryByText("Land Cruiser 2024")).not.toBeInTheDocument();
    expect(screen.queryByText(/Khalid/)).not.toBeInTheDocument();
  });

  it("works in Arabic", async () => {
    unlockPhone();
    server.use(http.get("/api/slots", () => HttpResponse.json(view())));
    const { user } = renderWithApp(<SlotsPage />, { user: null, locale: "ar" });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    expect(screen.getByRole("button", { name: "طلب خدمة خفيفة" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- features/bookings/slots` → FAIL (module not found).

- [ ] **Step 3: API helper and PIN screen**

Create `features/bookings/slots/api.ts`:

```ts
import { buildQuery, toApiError } from "@/lib/api/client";

/**
 * The sales page has no user and no access token: the API reads an httpOnly
 * cookie set when the PIN was typed. So these calls bypass the token logic of
 * `api()` and only send the cookie plus the CSRF header.
 */
const CSRF = { "X-Requested-With": "wolfcar" };

/** Set by the API next to the httpOnly cookie; only says "this phone was probably unlocked". */
export function hasSlotsHint(): boolean {
  return typeof document !== "undefined" && document.cookie.split("; ").some((c) => c.startsWith("wc_slots="));
}

export async function slotsApi<T>(
  path: string,
  options: { method?: "GET" | "POST"; json?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const res = await fetch(`/api/slots${path}${buildQuery(options.query)}`, {
    method: options.method ?? "GET",
    headers: { ...CSRF, ...(options.json !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    credentials: "same-origin",
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}
```

Create `features/bookings/slots/pin-screen.tsx`:

```tsx
"use client";

import { LockOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { AuthCard } from "@/components/app/auth-card";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { pinField } from "../shared/schemas";
import { slotsApi } from "./api";

/** One shared PIN, typed once per phone. */
export function PinScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const parsed = pinField.safeParse(pin);
    if (!parsed.success) return setInvalid(true);
    setBusy(true);
    try {
      await slotsApi("/unlock", { method: "POST", json: { pin: parsed.data } });
      onUnlocked();
    } catch (e) {
      setError(message(e));
      setPin("");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard brand={t("Brand.name")} title={t("Slots.title")} subtitle={t("Slots.pinSubtitle")}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {error && (
          <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
            {error}
          </p>
        )}
        <Field label={t("Slots.pin")} error={invalid ? "pin" : undefined}>
          <Input
            ref={input}
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            maxLength={6}
            autoFocus
            className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setInvalid(false);
            }}
          />
        </Field>
        <Button type="submit" size="touch" disabled={busy} className="w-full">
          <LockOpen aria-hidden="true" />
          {busy ? t("Slots.opening") : t("Slots.open")}
        </Button>
      </form>
    </AuthCard>
  );
}
```

(If `components/ui/input.tsx` does not forward `ref` as a prop — React 19 function components do by default — use `document.activeElement`-free focus instead: drop the ref and add `key={error ?? "pin"}` with `autoFocus` on the input.)

- [ ] **Step 4: Request form and side panel**

Create `features/bookings/slots/request-form.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFieldError } from "@/features/admin/shared/ui";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { BOOKING_NAME_MAX, BOOKING_NOTE_MAX } from "@/shared/validation";
import { formatDay } from "../shared/dates";
import { nameField, optionalPhone, requiredText } from "../shared/schemas";
import { slotsApi } from "./api";

const NAME_KEY = "wc_sales_name";
/** The salesperson's name is kept on the phone so it is typed once (storage may be blocked: then it is just asked again). */
function rememberedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // private mode: nothing to do
  }
}

const schema = z.object({
  salesName: nameField,
  car: nameField,
  ownerName: nameField,
  phone: optionalPhone,
  note: requiredText(BOOKING_NOTE_MAX),
});
type Input_ = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** Asks the call center to fit a light job into a day closed by a full PPF. */
export function RequestDialog({ date, open, onOpenChange, onSent }: { date: string; open: boolean; onOpenChange: (open: boolean) => void; onSent: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("Common.close")} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Slots.requestTitle")}</DialogTitle>
          <DialogDescription>
            {formatDay(date, locale)}. {t("Slots.requestBody")}
          </DialogDescription>
        </DialogHeader>
        <RequestForm date={date} onCancel={() => onOpenChange(false)} onSent={onSent} />
      </DialogContent>
    </Dialog>
  );
}

function RequestForm({ date, onCancel, onSent }: { date: string; onCancel: () => void; onSent: () => void }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Input_, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: { salesName: rememberedName(), car: "", ownerName: "", phone: "", note: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await slotsApi("/requests", { method: "POST", json: { date, ...values } });
      rememberName(values.salesName);
      toast.success(t("Slots.sent"));
      onSent();
    } catch (e) {
      setError(message(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {error && (
        <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      <Field label={t("Slots.salesName")} error={fe(errors.salesName?.message, { max: BOOKING_NAME_MAX })}>
        <Input autoComplete="name" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("salesName")} />
      </Field>
      <Field label={t("Slots.car")} error={fe(errors.car?.message, { max: BOOKING_NAME_MAX })}>
        <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("car")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Slots.ownerName")} error={fe(errors.ownerName?.message, { max: BOOKING_NAME_MAX })}>
          <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("ownerName")} />
        </Field>
        <Field label={t("Slots.phone")} optional error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="off" dir="ltr" className="text-start" maxLength={20} {...form.register("phone")} />
        </Field>
      </div>
      <Field label={t("Slots.note")} error={fe(errors.note?.message, { max: BOOKING_NOTE_MAX })}>
        <Textarea dir="auto" rows={3} maxLength={BOOKING_NOTE_MAX} {...form.register("note")} />
      </Field>
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("Common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("Common.saving") : t("Slots.send")}
        </Button>
      </DialogFooter>
    </form>
  );
}
```

Create `features/bookings/slots/side-panel.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { Pill } from "@/components/app/badges";
import { isolate } from "@/features/admin/shared/ui";
import type { RequestStatus, SalesBooking, SalesRequest } from "@/lib/api/types";
import { formatDay } from "../shared/dates";

const TONE: Record<RequestStatus, "warning" | "success" | "neutral"> = { PENDING: "warning", APPROVED: "success", REJECTED: "neutral" };

/** What is already booked from today on, and what happened to recent light-job requests. */
export function SidePanel({ bookings, requests }: { bookings: SalesBooking[]; requests: SalesRequest[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const short = (day: string) => formatDay(day, locale, "short");

  return (
    <div className="grid gap-6 p-4">
      <section>
        <h3 className="mb-2 text-[15px] font-extrabold text-ink-2">{t("Slots.cars")}</h3>
        {bookings.length === 0 ? (
          <p className="text-[15px] text-muted">{t("Slots.noCars")}</p>
        ) : (
          <ul className="grid gap-2.5">
            {bookings.map((b) => (
              <li key={b.id}>
                <article aria-label={b.car} className="rounded-[var(--radius-brand)] border border-line p-3">
                  <Pill tone={b.type === "FULL" ? "danger" : "warning"}>{t(`PpfBookings.types.${b.type}`)}</Pill>
                  <p dir="auto" className="mt-1.5 text-[16px] font-extrabold">
                    {b.car}
                  </p>
                  <p className="text-[15px] text-ink-2">
                    <span dir="auto">{b.ownerName}</span>
                    {b.phone && (
                      <>
                        {" · "}
                        <a href={`tel:${b.phone.replaceAll(" ", "")}`} dir="ltr" className="font-semibold underline underline-offset-2">
                          {b.phone}
                        </a>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-[14px] font-semibold">{t("Slots.receive", { date: short(b.receiveDate) })}</p>
                  <p className="text-[14px] text-ink-2">{b.deliveryDate ? t("Slots.delivery", { date: short(b.deliveryDate) }) : t("Slots.noDelivery")}</p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[15px] font-extrabold text-ink-2">{t("Slots.requests")}</h3>
        {requests.length === 0 ? (
          <p className="text-[15px] text-muted">{t("Slots.noRequests")}</p>
        ) : (
          <ul className="grid gap-2.5">
            {requests.map((r) => (
              <li key={r.id}>
                <article aria-label={r.car} className="rounded-[var(--radius-brand)] border border-line p-3">
                  <Pill tone={TONE[r.status]}>{t(`PpfBookings.requestStatus.${r.status}`)}</Pill>
                  <p dir="auto" className="mt-1.5 text-[16px] font-extrabold">
                    {r.car}
                  </p>
                  <p className="text-[14px] text-ink-2">{t("Slots.requestLine", { name: isolate(r.salesName), date: short(r.date) })}</p>
                  {r.decisionNote && (
                    <p dir="auto" className="mt-1.5 rounded-[8px] bg-sand px-2.5 py-1.5 text-[14px]">
                      {r.decisionNote}
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: The page**

Create `features/bookings/slots/slots-page.tsx`:

```tsx
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { BrandMark } from "@/components/app/brand";
import { Pill } from "@/components/app/badges";
import { ErrorState } from "@/components/app/states";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useWideLayout } from "@/features/admin/shared/ui";
import { ApiError } from "@/lib/api/client";
import type { SlotsView } from "@/lib/api/types";
import { qatarDay } from "@/lib/format";
import { addMonths, formatDay, monthOf, monthRange } from "../shared/dates";
import { MonthCalendar } from "../shared/month-calendar";
import { hasSlotsHint, slotsApi } from "./api";
import { PinScreen } from "./pin-screen";
import { RequestDialog } from "./request-form";
import { SidePanel } from "./side-panel";

const HEADER_H = "66px";
const STATE_TONE = { OPEN: "success", FULL: "danger", CLOSED: "neutral" } as const;
const noop = () => () => undefined;

/**
 * The salespeople's read-only view of the PPF calendar, protected by a shared
 * PIN. `null` = not known yet (the hint cookie cannot be read on the server).
 */
export function SlotsPage() {
  const queryClient = useQueryClient();
  const hinted = useSyncExternalStore<boolean | null>(noop, hasSlotsHint, () => null);
  /** what this tab learned since loading: a fresh unlock, or the API refusing the cookie */
  const [known, setKnown] = useState<boolean | null>(null);
  const unlocked = known ?? hinted;

  if (unlocked === null) {
    return (
      <div className="grid min-h-dvh place-items-center bg-sand" role="status">
        <Skeleton className="h-1.5 w-40 rounded-full" />
      </div>
    );
  }
  if (!unlocked) {
    return (
      <PinScreen
        onUnlocked={() => {
          // never show what an earlier PIN could see
          queryClient.removeQueries({ queryKey: ["slots"] });
          setKnown(true);
        }}
      />
    );
  }
  return <Slots onLocked={() => setKnown(false)} />;
}

function Slots({ onLocked }: { onLocked: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const wide = useWideLayout("(min-width: 1024px)");
  const [thisMonth] = useState(() => monthOf(qatarDay(new Date())));
  const [month, setMonth] = useState(thisMonth);
  const [selected, setSelected] = useState<string | null>(null);
  /** null = not chosen yet: open on wide screens, closed on phones */
  const [panel, setPanel] = useState<boolean | null>(null);
  const [requesting, setRequesting] = useState(false);
  const panelOpen = panel ?? wide;

  const view = useQuery({
    queryKey: ["slots", month],
    queryFn: async () => {
      try {
        return await slotsApi<SlotsView>("", { query: monthRange(month) });
      } catch (e) {
        // the PIN was changed, or the 90 days are over
        if (e instanceof ApiError && e.status === 401) onLocked();
        throw e;
      }
    },
    refetchInterval: 60_000,
    retry: false,
  });

  const data = view.data;
  const info = selected ? data?.days.find((d) => d.date === selected) : undefined;
  const fullCar = selected ? data?.bookings.find((b) => b.type === "FULL" && b.receiveDate === selected) : undefined;
  const canRequest = info?.state === "FULL" && data !== undefined && info.date >= data.today;
  const panelBody = <SidePanel bookings={data?.bookings ?? []} requests={data?.requests ?? []} />;
  const PanelIcon = panelOpen ? PanelRightClose : PanelRightOpen;

  return (
    <div className="min-h-dvh bg-sand">
      <header className="sticky top-0 z-30 border-b border-line bg-surface" style={{ height: HEADER_H }}>
        <div className="flex h-full items-center justify-between gap-2 px-4 lg:px-6">
          <BrandMark name={t("Brand.name")} sub={`${t("Slots.title")} · ${t("Slots.branch")}`} />
          <div className="flex shrink-0 items-center gap-1">
            <LocaleSwitcher className="px-2" />
            <ThemeToggle />
            <Button
              variant="outline"
              size="icon"
              className="ms-1"
              aria-expanded={panelOpen}
              aria-label={t(panelOpen ? "Slots.hidePanel" : "Slots.showPanel")}
              onClick={() => setPanel(!panelOpen)}
            >
              <PanelIcon className="rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <div className={wide && panelOpen ? "grid grid-cols-[minmax(0,1fr)_380px]" : undefined}>
        <main className="mx-auto w-full max-w-3xl px-4 py-5 lg:px-6">
          <h1 className="sr-only">{`${t("Slots.title")} · ${t("Slots.branch")}`}</h1>
          {view.isError && !data ? (
            <ErrorState error={view.error} onRetry={() => void view.refetch()} />
          ) : (
            <div className="rounded-[var(--radius-brand-lg)] border border-line bg-surface p-3 sm:p-4">
              <MonthCalendar
                month={month}
                days={data?.days}
                today={data?.today}
                selected={selected}
                onSelect={setSelected}
                onMonthChange={(next) => {
                  setMonth(next);
                  setSelected(null);
                }}
                minMonth={thisMonth}
                maxMonth={addMonths(thisMonth, 12)}
              />
            </div>
          )}

          {selected && info && (
            <section aria-label={formatDay(selected, locale)} className="mt-4 rounded-[var(--radius-brand-lg)] border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg leading-tight font-extrabold">{formatDay(selected, locale)}</h2>
                <Pill tone={STATE_TONE[info.state]}>{t(`Calendar.states.${info.state}`)}</Pill>
              </div>
              {info.state === "OPEN" && <p className="mt-2 text-[15px] text-ink-2">{t("Slots.dayOpen")}</p>}
              {info.state === "CLOSED" && (
                <>
                  <p className="mt-2 text-[15px] font-semibold text-ink-2">{t("Slots.dayClosed")}</p>
                  {info.reason && (
                    <p dir="auto" className="text-[15px] text-ink-2">
                      {info.reason}
                    </p>
                  )}
                </>
              )}
              {info.state === "FULL" && (
                <>
                  <p className="mt-2 text-[15px] font-semibold text-ink-2">{t("Slots.dayFull")}</p>
                  {fullCar && (
                    <p dir="auto" className="text-[17px] font-extrabold">
                      {fullCar.car}
                    </p>
                  )}
                  {canRequest && (
                    <Button size="touch" className="mt-3 w-full sm:w-auto" onClick={() => setRequesting(true)}>
                      {t("Slots.requestLight")}
                    </Button>
                  )}
                </>
              )}
              {info.lightCount > 0 && <p className="mt-2 text-[14px] text-ink-2">{t("Calendar.light", { count: info.lightCount })}</p>}
            </section>
          )}
        </main>

        {wide && panelOpen && (
          <aside className="border-s border-line bg-surface" aria-label={t("Slots.cars")}>
            <div className="sticky overflow-y-auto" style={{ top: HEADER_H, height: `calc(100dvh - ${HEADER_H})` }}>
              {panelBody}
            </div>
          </aside>
        )}
      </div>

      <Sheet open={!wide && panelOpen} onOpenChange={setPanel}>
        <SheetContent side="bottom" closeLabel={t("Common.close")} className="h-[85dvh] gap-0">
          <SheetHeader>
            <SheetTitle>{t("Slots.cars")}</SheetTitle>
          </SheetHeader>
          <SheetBody className="p-0">{panelBody}</SheetBody>
        </SheetContent>
      </Sheet>

      {selected && (
        <RequestDialog
          date={selected}
          open={requesting}
          onOpenChange={setRequesting}
          onSent={() => {
            setRequesting(false);
            void queryClient.invalidateQueries({ queryKey: ["slots"] });
          }}
        />
      )}
    </div>
  );
}
```

`SheetBody` has its own padding in this project; check `components/ui/sheet.tsx` and keep the override (`p-0`) only if the body would otherwise be padded twice with `SidePanel`'s `p-4`.

Create `app/[locale]/(app)/slots/page.tsx` — it sits beside `showroom/`, inside the `(app)` layout that supplies the messages and providers, and needs no session provider:

```tsx
import { SlotsPage } from "@/features/bookings/slots/slots-page";

export default function Slots() {
  return <SlotsPage />;
}
```

`proxy.ts` is not changed: it only redirects `/dashboard` and `/showroom`.

- [ ] **Step 6: Run the tests**

Run: `npm test -- features/bookings && npm run typecheck && npm run lint` → PASS.

Then look at it for real (both databases up, API on :4000 with a PIN set through the dashboard):

```bash
npm run dev
```

Open `http://localhost:3000/ar/slots` in a phone-sized window: PIN screen → calendar; a full day shows the car and the request button; the panel opens as a bottom sheet; switch to English and to dark mode. Fix anything that overflows at 360 px wide.

- [ ] **Step 7: Commit**

```bash
git add features/bookings/slots app
git commit -m "feat(web): PIN-protected sales slots page"
```

---

### Task 14: Browser story, README, full verification

**Files:**
- Create: `e2e/bookings.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything. Labels used below are the English texts from `messages/app/en/bookings.json` (Task 8) and the existing users page (`Add user`, dialog `New user`, field `Full name`, credentials dialog `Save these credentials now`, button `I've saved them`).

- [ ] **Step 1: Write the browser test**

Create `e2e/bookings.spec.ts`:

```ts
import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, signIn, signOut, test } from "./fixtures/test";

/**
 * PPF bookings from end to end: the Super Admin creates the call-center
 * account, she sets the sales PIN and books a full PPF, a salesperson unlocks
 * the slots page, sees the day closed and asks for a light job, she approves
 * it, and the salesperson sees the answer.
 */
test.describe.configure({ mode: "serial" });

const PIN = "482915";
/** A day comfortably ahead in the current month view's reach: the 2nd next month, day 15. */
function targetDay(): { day: string; monthsAhead: number } {
  const qatar = new Date(Date.now() + 3 * 3_600_000);
  const d = new Date(Date.UTC(qatar.getUTCFullYear(), qatar.getUTCMonth() + 1, 15));
  return { day: d.toISOString().slice(0, 10), monthsAhead: 1 };
}
const { day: DAY, monthsAhead } = targetDay();
const cell = (page: Page, date: string) => page.locator(`button[data-date="${date}"]`);
async function goToTargetMonth(page: Page) {
  for (let i = 0; i < monthsAhead; i++) await page.getByRole("button", { name: "Next month" }).click();
  await expect(cell(page, DAY)).toBeEnabled();
}

test("admin → call center → sales → call center → sales", async ({ page, browser }) => {
  let amani = { username: "", password: "" };

  await test.step("Super Admin creates the Reservations account", async () => {
    await signIn(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password);
    await page.goto("/en/dashboard/users");
    await page.getByRole("button", { name: "Add user" }).click();
    const dialog = page.getByRole("dialog", { name: "New user" });
    await dialog.getByLabel("Full name").fill("Amani");
    await dialog.getByRole("radio", { name: /Reservations/ }).check({ force: true });
    await dialog.getByRole("button", { name: "Create" }).click();

    const credentials = page.getByRole("dialog", { name: "Save these credentials now" });
    await expect(credentials).toBeVisible();
    const secrets = await credentials.getByTestId("secret").allInnerTexts();
    amani = { username: secrets[0].trim(), password: secrets[1].trim() };
    expect(amani.username).toBe("reservations");
    await page.getByRole("button", { name: "I've saved them" }).click();
    await signOut(page);
  });

  await test.step("Amani lands on PPF bookings, sets the PIN and books a full PPF", async () => {
    await signIn(page, amani.username, amani.password);
    await page.waitForURL(/\/en\/dashboard\/ppf-bookings/);
    await expect(page.getByRole("link", { name: "General reservations" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);

    const sales = page.getByRole("region", { name: "Sales page" });
    await expect(sales.getByText(/No PIN yet/)).toBeVisible();
    await sales.getByRole("button", { name: "Set PIN" }).click();
    const pin = page.getByRole("dialog", { name: "Sales PIN" });
    await pin.getByLabel("PIN").fill(PIN);
    await pin.getByRole("button", { name: "Save" }).click();
    await expect(sales.getByText("A PIN is set.")).toBeVisible();

    await goToTargetMonth(page);
    await cell(page, DAY).click();
    await page.getByRole("button", { name: "Add booking" }).click();
    const form = page.getByRole("dialog", { name: "New booking" });
    await form.getByLabel("Car").fill("Land Cruiser 2024");
    await form.getByLabel("Owner name").fill("Khalid Al-Marri");
    await form.getByLabel(/Phone/).fill("55123456");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("article", { name: "Land Cruiser 2024" })).toBeVisible();
    await expect(cell(page, DAY)).toHaveAttribute("data-state", "FULL");

    // a second full PPF on the same day is refused
    await page.getByRole("button", { name: "Add booking" }).click();
    await form.getByLabel("Car").fill("Patrol");
    await form.getByLabel("Owner name").fill("Hamad");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByRole("alert")).toHaveText("A full PPF is already booked on this day.");
    await form.getByRole("button", { name: "Cancel" }).click();
  });

  // the salesperson is a different person on a different phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", timezoneId: "Asia/Qatar" });
  const sales = await phone.newPage();

  await test.step("A salesperson unlocks the slots page and asks for a light job", async () => {
    await sales.goto("/en/slots");
    await sales.getByLabel("PIN").fill("000000");
    await sales.getByRole("button", { name: "Open" }).click();
    await expect(sales.getByRole("alert")).toHaveText("Wrong PIN.");
    await sales.getByLabel("PIN").fill(PIN);
    await sales.getByRole("button", { name: "Open" }).click();

    await goToTargetMonth(sales);
    await expect(cell(sales, DAY)).toHaveAttribute("data-state", "FULL");
    await cell(sales, DAY).click();
    await expect(sales.getByText("Closed: a full PPF car is booked.")).toBeVisible();
    await sales.getByRole("button", { name: "Request a light job" }).click();
    const request = sales.getByRole("dialog", { name: "Request a light job" });
    await request.getByLabel("Your name").fill("Yousef");
    await request.getByLabel("Car").fill("Lexus LX");
    await request.getByLabel("Owner name").fill("Sara Al-Kuwari");
    await request.getByLabel("What is the job?").fill("Front windows tint");
    await request.getByRole("button", { name: "Send request" }).click();
    await expect(request).toHaveCount(0);

    await sales.getByRole("button", { name: "Show booked cars" }).click();
    const panel = sales.getByRole("dialog", { name: "Booked cars" });
    await expect(panel.getByRole("article", { name: "Land Cruiser 2024" }).getByRole("link", { name: "55123456" })).toBeVisible();
    await expect(panel.getByRole("article", { name: "Lexus LX" }).getByText("Waiting")).toBeVisible();

    // the phone is remembered: a reload does not ask for the PIN again
    await sales.reload();
    await expect(sales.getByLabel("PIN")).toHaveCount(0);
    await expect(sales.getByRole("button", { name: "Next month" })).toBeVisible();
  });

  await test.step("Amani sees the request waiting and approves it", async () => {
    await page.reload();
    await expect(page.getByRole("link", { name: /PPF bookings/ })).toContainText("1");
    await page.getByRole("tab", { name: /Requests/ }).click();
    const card = page.getByRole("article", { name: "Lexus LX" });
    await expect(card.getByText("Front windows tint")).toBeVisible();
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(card.getByText("Approved")).toBeVisible();

    await page.getByRole("tab", { name: "Calendar" }).click();
    await goToTargetMonth(page);
    await cell(page, DAY).click();
    const light = page.getByRole("article", { name: "Lexus LX" });
    await expect(light.getByText("Light job")).toBeVisible();
    await expect(light.getByText("Requested by Yousef")).toBeVisible();
    await expect(cell(page, DAY)).toHaveAttribute("data-state", "FULL");
  });

  await test.step("The salesperson sees the answer and the light job", async () => {
    await sales.reload();
    await sales.getByRole("button", { name: "Show booked cars" }).click();
    const panel = sales.getByRole("dialog", { name: "Booked cars" });
    await expect(panel.getByRole("article", { name: "Lexus LX" }).getByText("Approved")).toBeVisible();
    await expect(panel.getByRole("article", { name: "Lexus LX" }).getByText("Light job")).toBeVisible();
  });

  await test.step("A general reservation stays out of the sales page", async () => {
    await page.goto("/en/dashboard/reservations");
    await page.getByRole("button", { name: "Add reservation" }).click();
    const form = page.getByRole("dialog", { name: "New reservation" });
    await form.getByLabel("Service").fill("Ceramic coating for Hidden Customer");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("article", { name: "Ceramic coating for Hidden Customer" })).toBeVisible();

    await sales.reload();
    await sales.getByRole("button", { name: "Show booked cars" }).click();
    await expect(sales.getByText(/Hidden Customer/)).toHaveCount(0);
  });

  await test.step("Changing the PIN signs the phone out", async () => {
    await page.goto("/en/dashboard/ppf-bookings");
    const card = page.getByRole("region", { name: "Sales page" });
    await card.getByRole("button", { name: "Change PIN" }).click();
    const pin = page.getByRole("dialog", { name: "Sales PIN" });
    await pin.getByLabel("PIN").fill("135790");
    await pin.getByRole("button", { name: "Save" }).click();
    await expect(pin).toHaveCount(0);

    await sales.reload();
    await expect(sales.getByLabel("PIN")).toBeVisible();
    await expect(sales.getByText(/Khalid/)).toHaveCount(0);
  });

  await phone.close();
});
```

Notes for whoever runs it:
- "Lexus LX" appears twice in the sales panel after approval (once as a booked car, once as a request); if a strict-mode locator error says so, narrow the two assertions in the last-but-two step with `.filter({ hasText: "Approved" })` and `.filter({ hasText: "Light job" })`.
- The custom radio in the user form hides its `<input>`; `check({ force: true })` clicks it anyway. If that still fails, click the role's label text (`dialog.getByText("Reservations", { exact: true })`).
- The 401 on `/api/slots` after the PIN change and the 409 on the second full PPF are already in the fixture's list of expected console messages.

- [ ] **Step 2: Run it**

```bash
docker compose up -d db-test
npm run e2e:build
npx playwright test e2e/bookings.spec.ts
```

Expected: 1 passed. Then the whole browser suite: `npm run test:e2e` → all pass (the landing snapshots are untouched).

- [ ] **Step 3: README**

In `README.md`:

- Section 4 (demo accounts): add under the table — `The seed creates no Reservations account: the Super Admin adds it on Dashboard → Users (role Reservations; the username is \`reservations\`).`
- Section 6 (tests), "What they cover": add to **API e2e** — `PPF bookings (one full PPF per day, also under concurrent requests; closed days; light-job requests), the PIN-protected sales page (cookie scope, PIN change signs phones out, lockout, no internal fields) and general reservations.` Add to **Playwright** — `the bookings story (admin creates the call-center account → she books a full PPF → sales asks for a light job → she approves it).`
- Section 7 (permission model): change the roles list to `(\`SUPER_ADMIN\`, \`FINANCE\`, \`BRANCH_MANAGER\`, \`CASHIER\`, \`RESERVATIONS\`)` and add three rows to the table, after `order.receipt.download`:

```markdown
| `booking.ppf.read` | View the PPF calendar, bookings and light-job requests | Reservations |
| `booking.ppf.manage` | Add, edit and cancel PPF bookings; close and reopen days; answer requests; set the sales PIN | Reservations |
| `booking.general.manage` | View and manage general reservations | Reservations |
```

- After section 7, add:

```markdown
### PPF bookings and the sales page

PPF and tinting are booked for **Bin Omran only**, by the call center (role *Reservations*) on *Dashboard → PPF bookings*. One **full PPF** closes its receive day — a partial unique index (`ppf_bookings_one_full_per_day`) guarantees it. **Light jobs** never close a day. The delivery day is information only. The call center can also close a day by hand.

Salespeople have no accounts. They open **`/ar/slots`** (or `/en/slots`) and type a shared 6-digit PIN once per phone; the phone is remembered for 90 days. The page is read-only except for one thing: on a day closed by a full PPF they can send a light-job request, which the call center approves or rejects in the dashboard. Changing the PIN signs every phone out. Five wrong PINs lock PIN entry for `LOGIN_LOCK_MINUTES`.

*Dashboard → General reservations* is the call center's private list of every other reservation; nothing in it reaches the sales page.
```

- Section 8 (security notes), **Sessions**: append — `The sales slots page uses neither: a PIN is exchanged for a signed 90-day cookie (\`httpOnly; SameSite=Strict\`, scoped to \`/api/slots\`) that carries the PIN's version and is rejected everywhere else.`
- Section 10 (project structure): add `app/[locale]/(app)/slots/           sales slots page (PIN)` and extend the two lists — dashboard pages with `ppf-bookings, reservations`; API modules with `ppf, reservations, sales-access`.

- [ ] **Step 4: Full verification**

```bash
cd api && npm run typecheck && npm run lint && npm test && npm run test:e2e
cd .. && npm run typecheck && npm run lint && npm test && npm run build
```

Expected: everything passes and the build completes. Read the build output: the three new routes must be listed (`/[locale]/dashboard/ppf-bookings`, `/[locale]/dashboard/reservations`, `/[locale]/slots`).

- [ ] **Step 5: Commit**

```bash
git add e2e README.md
git commit -m "test(e2e): bookings story; docs: PPF bookings and the sales page"
```
