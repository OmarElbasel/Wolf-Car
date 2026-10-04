# PPF bookings and general reservations — design

Date: 2026-10-04 · Status: waiting for review

## Goal

Bookings for PPF and tinting arrive by WhatsApp, by phone and in person, and
today nothing shows who is booked on which day. This adds:

1. **PPF bookings** — one calendar for the Bin Omran branch, managed by the
   call center (Amani). A full PPF car closes its day.
2. **A sales page** — salespeople open a link on their phone to see which days
   are open before promising a customer a full package. It is read-only, with
   one exception: on a closed day they can ask Amani to fit in a light job.
3. **General reservations** — a private list where Amani records any other
   reservation. No slots, never shown to sales.

The Super Admin can see and do everything in all three.

## Decisions already made

| Topic | Decision |
|---|---|
| Who manages bookings | Amani, with her own dashboard account in a new **Reservations** role. The Super Admin creates the account. |
| Branches | **Bin Omran only.** There is one calendar and bookings carry no branch. An Al Gharrafa calendar is not part of this. |
| What closes a day | Only a **full PPF** booking. One per day. |
| Light jobs | Tinting and small PPF jobs. Amani can add them on any day, with no limit. They never close a day. |
| Which day closes | The **receive day** (the car arrives). The delivery day is recorded for information and closes nothing. The days in between stay open. |
| Sales access | No accounts. One simple address and a **6-digit PIN**, typed once per phone and remembered for 90 days. Amani or the Super Admin can change the PIN. |
| What sales can do | Read the calendar and the list of booked cars. Send a light-job request for a day closed by a full PPF. Nothing else. |
| How requests reach Amani | Inside the dashboard: a counter and an inbox. No WhatsApp or email is sent. |
| Booking an open day | Still goes through Amani by phone or WhatsApp. Sales cannot create bookings. |

## What each person sees

### Amani — PPF bookings (`/dashboard/ppf-bookings`)

- A month calendar (weeks start on Saturday). Each day shows one of three states:
  - **Open** — no full PPF booked.
  - **Booked** — a full PPF car is booked; the car is named on the day.
  - **Closed** — Amani closed it by hand; the reason is shown.
  - Light jobs show as a count on the day.
- Selecting a day lists its bookings and offers **Add booking**:

  | Field | Rule |
  |---|---|
  | Type | Full PPF or Light job |
  | Car | required, free text (make and model), 2–80 characters |
  | Owner name | required, 2–80 characters |
  | Phone | optional, `+` and digits and spaces, 6–20 characters |
  | Service | optional, free text, up to 200 characters (the package, or "tint") |
  | Receive day | required |
  | Delivery day | optional, not before the receive day |
  | Note | optional, up to 1,000 characters |

- **Edit** changes any field, including moving the booking to another day.
- **Cancel** keeps the booking in the list, marked cancelled, and frees its day.
  A cancelled booking cannot be edited.
- **Close day** takes an optional reason; **Reopen** removes it. A day closed by
  hand takes no new bookings of either type. Bookings already on it stay.
- **Requests** tab: light-job requests from sales, newest first, with a counter
  of those waiting. The same counter shows on the menu item. **Approve** adds a
  light job on that day from the request's details (Amani can edit it
  afterwards). **Reject** takes an optional reason that sales will see.
- **Sales page** card: the link to share, whether a PIN is set, and
  **Set PIN / Change PIN** (type 6 digits or generate them). Changing the PIN
  signs every phone out.

She may enter past receive days, to record a job after the fact.

### Amani — General reservations (`/dashboard/reservations`)

- A list grouped by day, with a date range filter and a search over owner name,
  phone, car and service. Today and later is the default range.
- **Add / Edit / Cancel**, same cancel behaviour as above.

  | Field | Rule |
  |---|---|
  | Day | required |
  | Hour | optional, `HH:mm` |
  | Service | required, free text, up to 200 characters |
  | Owner name | optional |
  | Phone | optional |
  | Car | optional |
  | Note | optional, up to 1,000 characters |

Nothing here closes anything, and nothing here reaches the sales page.

### Sales — PPF slots (`/ar/slots`, `/en/slots`)

Built phone-first in the showroom's visual style, but a separate page.

- First visit: a PIN screen. After the right PIN the phone is remembered for 90
  days. If no PIN has been set yet, the page says to contact the call center.
- The month calendar, read-only, with the same three states and a legend. Sales
  can browse from the current month up to 12 months ahead.
- A **side panel that opens and closes** (a sheet on phones, a collapsible
  column on wide screens) with two lists:
  - **Booked cars** — every active booking whose receive or delivery day is
    today or later: car, owner name, phone if there is one, receive day,
    delivery day, and whether it is a full PPF or a light job.
  - **Requests** — requests from the last 14 days or for a day still ahead,
    with their state: waiting, approved, or rejected with Amani's reason.
- Tapping a day closed by a full PPF shows the booked car and a
  **Request a light job** button. The form: salesperson's name, car, owner
  name, phone (optional), note (required — what the job is).
- Open days and days closed by hand have no button.
- The page refreshes its data every minute.

### Super Admin

Sees both menu items and can do everything Amani can. The two new pages and
their permissions appear on *Dashboard → Permissions*, so access can also be
given to someone else later (for example view-only access to PPF bookings).

## Accounts and permissions

- New role `RESERVATIONS`. It is not tied to a branch, like Finance. It is
  created on *Dashboard → Users* next to Super Admin and Finance. The generated
  username is `reservations`. It lands on `/dashboard/ppf-bookings` after
  sign-in. Two-factor is available as for every account.
- New permission group `booking`:

  | Permission | What it allows | Default roles |
  |---|---|---|
  | `booking.ppf.read` | View the PPF calendar, bookings and light-job requests | Reservations |
  | `booking.ppf.manage` | Add, edit and cancel PPF bookings; close and reopen days; answer requests; set the sales PIN | Reservations |
  | `booking.general.manage` | View and manage general reservations | Reservations |

  Super Admin holds all three automatically. Finance, managers and cashiers get
  none by default.
- Menu: **PPF bookings** shows with `booking.ppf.read`; **General
  reservations** shows with `booking.general.manage`. A user with only
  `booking.ppf.read` sees the PPF page without any of the buttons.

## Rules the API enforces

The web pages hide what a user cannot do, but the API is the source of truth,
as everywhere else in this app.

- **One full PPF per day.** Creating or moving a full booking onto a day that
  already has one is refused (`409 PPF_DAY_FULL`). A partial unique index in
  the database guarantees it even when two requests arrive together.
- **Days closed by hand** refuse new bookings and bookings moved onto them
  (`409 PPF_DAY_CLOSED`).
- **Cancelled bookings and reservations** cannot be changed
  (`409 BOOKING_CANCELLED`).
- **A request is decided once** (`409 REQUEST_ALREADY_DECIDED`). Approving
  creates the light job and links it to the request in one transaction.
  Approval fails with `409 PPF_DAY_CLOSED` if the day was closed by hand in the
  meantime.
- **Sales requests** are accepted only for today or later (Qatar time), and
  only for a day that has an active full PPF booking and is not closed by hand
  (`409 PPF_DAY_NOT_FULL`).
- A day's state is worked out in one place on the server and sent to both the
  dashboard and the sales page, so the two can never disagree. A day closed by
  hand shows as **Closed** even when it also holds a full PPF booking;
  otherwise a full PPF booking makes it **Booked**; otherwise it is **Open**.
- All dates are calendar dates in Qatar time (`YYYY-MM-DD`), with no time zone
  conversion.

## Sales access (PIN)

- The PIN is stored hashed (argon2id, like passwords) in a one-row table,
  together with a **version** number that goes up each time the PIN changes.
- `POST /api/slots/unlock` checks the PIN and sets an `httpOnly`,
  `SameSite=Strict` cookie scoped to `/api/slots`. The cookie holds a signed
  token (the API's existing JWT secret, its own audience `slots`, 90 days) that
  carries the PIN version. A non-secret hint cookie on `/` lets the page skip
  the PIN screen without a wasted request, as the dashboard and showroom do.
- Every sales request to the API checks the token's signature and that its
  version is still the current one. Changing the PIN therefore signs every
  phone out at once.
- A `slots` token is not an access token: dashboard and showroom routes reject
  it, and the sales routes accept nothing else.
- Brute force: the unlock route uses the strict per-IP sign-in rate limit, and
  wrong PINs are counted on the one-row table. After `LOGIN_MAX_ATTEMPTS`
  (5) wrong PINs, unlocking is refused for `LOGIN_LOCK_MINUTES` (15) with
  `423 SALES_PIN_LOCKED`. Phones that are already unlocked keep working.
- The request route is cookie-authenticated, so it requires the existing CSRF
  header.
- The sales responses contain only what the page shows. No ids of staff, no
  audit fields, and no general reservations.

## Data model

New enums: `PpfBookingType` (`FULL`, `LIGHT`), `BookingStatus` (`BOOKED`,
`CANCELLED`), `LightJobRequestStatus` (`PENDING`, `APPROVED`, `REJECTED`).
`Role` gains `RESERVATIONS`.

| Table | Columns |
|---|---|
| `ppf_bookings` | id, type, status, car, owner_name, phone?, service?, receive_date, delivery_date?, note?, created_by_id, updated_by_id?, cancelled_by_id?, cancelled_at?, created_at, updated_at |
| `ppf_closed_days` | date (primary key), reason?, created_by_id, created_at |
| `light_job_requests` | id, date, sales_name, car, owner_name, phone?, note, status, decided_by_id?, decided_at?, decision_note?, booking_id? (unique, → `ppf_bookings`), created_at |
| `general_reservations` | id, date, time?, service, owner_name?, phone?, car?, note?, status, created_by_id, updated_by_id?, cancelled_by_id?, cancelled_at?, created_at, updated_at |
| `sales_access` | id (always 1), pin_hash?, version, failed_count, locked_until?, updated_by_id?, updated_at |

Hand-written SQL in the migration, in the style of the first migration:

- Partial unique index on `ppf_bookings (receive_date)` where
  `type = 'FULL' AND status = 'BOOKED'`.
- `CHECK` that `delivery_date` is null or not before `receive_date`.
- `CHECK` that `status = 'CANCELLED'` exactly when `cancelled_at` is set, on
  both booking tables.
- `CHECK` that `sales_access.id = 1`.

Indexes on `ppf_bookings (receive_date)`, `general_reservations (date)` and
`light_job_requests (status, created_at)`.

`ALTER TYPE "Role" ADD VALUE 'RESERVATIONS'` needs no change to the existing
`users_role_branch_check`: that constraint already treats every role other
than manager and cashier as having no branch.

## API

Dashboard routes (dashboard session; every state-changing route carries
`@Audit`):

| Route | Permission | Audit action |
|---|---|---|
| `GET /api/ppf/calendar?from&to` | `booking.ppf.read` | — |
| `GET /api/ppf/bookings?from&to&status&q&page` | `booking.ppf.read` | — |
| `POST /api/ppf/bookings` | `booking.ppf.manage` | `ppf_booking.create` |
| `PATCH /api/ppf/bookings/:id` | `booking.ppf.manage` | `ppf_booking.update` |
| `POST /api/ppf/bookings/:id/cancel` | `booking.ppf.manage` | `ppf_booking.cancel` |
| `PUT /api/ppf/closed-days/:date` | `booking.ppf.manage` | `ppf_day.close` |
| `DELETE /api/ppf/closed-days/:date` | `booking.ppf.manage` | `ppf_day.reopen` |
| `GET /api/ppf/requests?status&page` | `booking.ppf.read` | — |
| `POST /api/ppf/requests/:id/approve` | `booking.ppf.manage` | `ppf_request.approve` |
| `POST /api/ppf/requests/:id/reject` | `booking.ppf.manage` | `ppf_request.reject` |
| `GET /api/ppf/sales-access` | `booking.ppf.read` | — |
| `PUT /api/ppf/sales-access/pin` | `booking.ppf.manage` | `sales_access.pin_change` |
| `GET /api/reservations?from&to&status&q&page` | `booking.general.manage` | — |
| `POST /api/reservations` | `booking.general.manage` | `reservation.create` |
| `PATCH /api/reservations/:id` | `booking.general.manage` | `reservation.update` |
| `POST /api/reservations/:id/cancel` | `booking.general.manage` | `reservation.cancel` |

Sales routes (no user; PIN cookie):

| Route | Access | Audit action |
|---|---|---|
| `POST /api/slots/unlock` | public, strict rate limit | `sales_access.unlock` |
| `GET /api/slots?from&to` | PIN cookie | — |
| `POST /api/slots/requests` | PIN cookie + CSRF header | `ppf_request.create` |

`GET /api/ppf/calendar` and `GET /api/slots` accept at most 62 days per call.

The calendar response is a list of days (`date`, `state`: `OPEN` | `FULL` |
`CLOSED`, `reason`, `lightCount`) plus the bookings in the range. The PIN is
never written to the activity log; sales actions are logged without an actor
and with the salesperson's typed name in the metadata.

Code lives in three new NestJS modules: `ppf` (bookings, closed days,
requests), `reservations`, and `sales-access` (PIN, cookie, guard, the
`/api/slots` routes).

## Web

| Path | What |
|---|---|
| `app/[locale]/(app)/(staff)/dashboard/ppf-bookings/page.tsx` | Amani's PPF page |
| `app/[locale]/(app)/(staff)/dashboard/reservations/page.tsx` | General reservations |
| `app/[locale]/(app)/slots/page.tsx` | Sales page, with the PIN screen inline |
| `features/bookings/ppf/` | calendar page, booking form, day panel, requests inbox, sales-access card |
| `features/bookings/general/` | list, form |
| `features/bookings/slots/` | PIN screen, read-only calendar, side panel, request form |
| `features/bookings/shared/` | the month calendar and day-state badge used by both PPF pages; date helpers |
| `messages/app/{ar,en}/bookings.json` | texts for the three pages |

Changes to existing files: the role and permission lists in
`shared/permissions.ts`; shared field limits in `shared/validation.ts`; the
two menu items and the request counter in the dashboard shell and navigation;
the landing page for the new role; the role choice in the user form and its
API DTO; the username base for the new role; role, permission and error texts
in the message files; the README's permission table and structure.

`proxy.ts` is unchanged: the sales page shows its own PIN screen, so there is
nothing to redirect.

Both languages, right-to-left for Arabic, light and dark, as the rest of the
app.

## Not included

- WhatsApp, SMS or email notifications.
- A calendar for Al Gharrafa or any second calendar.
- Customers booking from the public website; the landing page's booking form
  keeps opening WhatsApp.
- Prices, payments or deposits on bookings; any link to orders or to Odoo.
- Salespeople creating, editing or cancelling bookings.
- Individual salesperson accounts.

## Testing

- **API unit** — day-state calculation; one full PPF per day; days closed by
  hand; cancelling frees the day; moving a booking; approve creates the light
  job, reject does not; a request decided twice; request rules (past day, open
  day, day closed by hand); PIN hashing, version check, lockout; the sales
  guard.
- **API e2e** — every new route in the RBAC matrix, with two new callers
  (`reservations`, and `sales` holding a PIN cookie); the database refuses two
  active full bookings on one day; two simultaneous creates give one `201` and
  one `409`; an old cookie stops working after a PIN change; the sales
  response leaks no internal fields; the audit-coverage test still passes.
- **Web** — PPF page (add, the "day is full" message, cancel, close and reopen
  a day, approve and reject); reservations page (add, edit, cancel, filter);
  sales page (PIN screen, the three day states, the request button only on
  full days, the side panel).
- **Playwright** — one story: the Super Admin creates the Reservations
  account → Amani sets the PIN and books a full PPF → sales unlocks, sees the
  day closed and sends a request → Amani approves → sales sees it approved and
  the light job in the list.

## Rollout

1. Deploy as usual. The migration runs when the API starts, and the new
   permissions with their default grants are added by the existing catalogue
   sync on startup.
2. The Super Admin creates Amani's account on *Dashboard → Users* (role
   Reservations) and gives her the one-time password.
3. Amani sets the sales PIN and shares the link and the PIN with the Bin Omran
   sales team.
