import { randomUUID } from 'node:crypto';
import { createTestApp, type TestApp } from './utils/app';
import { bearer, csrf, login, showroomLogin } from './utils/auth';
import { PW, seedWorld } from './utils/fixtures';
import { appRoutes } from './utils/routes';

type Caller = 'anon' | 'admin' | 'finance' | 'manager' | 'cashier' | 'kiosk';
const DASHBOARD: Caller[] = ['admin', 'finance', 'manager', 'cashier'];
const ALL: Caller[] = ['anon', ...DASHBOARD, 'kiosk'];

/**
 * Who may call each route. Everyone else must get 401 (no session) or 403
 * (wrong permission / wrong session type). Allowed callers must NOT get
 * 401/403 — they may get 400/404/409 because the matrix sends empty bodies
 * and random ids (so nothing is modified).
 *
 * Every route in the app must appear here: adding an endpoint without
 * deciding who may call it fails the "complete" test.
 */
const MATRIX: Record<string, Caller[] | { public: number }> = {
  'GET /api/health': { public: 200 },
  'POST /api/auth/login': ALL,
  'POST /api/auth/login/2fa': ALL,
  'POST /api/auth/refresh': { public: 401 }, // no refresh cookie
  'POST /api/auth/logout': { public: 204 },
  'GET /api/auth/me': DASHBOARD,
  'POST /api/auth/showroom/login': ALL,
  'POST /api/auth/showroom/refresh': { public: 401 },
  'POST /api/auth/showroom/logout': { public: 204 },
  'GET /api/auth/showroom/me': ['kiosk'],

  'PATCH /api/account/password': DASHBOARD,
  'PATCH /api/account/showroom-password': ['admin', 'manager', 'cashier'],
  'GET /api/account/2fa': DASHBOARD,
  'POST /api/account/2fa/setup': DASHBOARD,
  'POST /api/account/2fa/enable': DASHBOARD,
  'POST /api/account/2fa/disable': DASHBOARD,
  'POST /api/account/2fa/recovery-codes': DASHBOARD,

  'GET /api/permissions': ['admin'],
  'GET /api/roles/permissions': ['admin'],
  'PUT /api/roles/:role/permissions': ['admin'],
  'GET /api/users/:id/permissions': ['admin'],
  'PUT /api/users/:id/permissions': ['admin'],

  'GET /api/users': ['admin'],
  'POST /api/users': ['admin'],
  'GET /api/users/:id': ['admin'],
  'PATCH /api/users/:id': ['admin'],
  'DELETE /api/users/:id': ['admin'],
  'POST /api/users/:id/reset-password': ['admin'],
  'POST /api/users/:id/reset-showroom-password': ['admin'],
  'POST /api/users/:id/reset-2fa': ['admin'],
  'POST /api/users/:id/unlock': ['admin'],

  'GET /api/branches': ['admin'],
  'POST /api/branches': ['admin'],
  'GET /api/branches/:id': ['admin'],
  'PATCH /api/branches/:id': ['admin'],
  'POST /api/branches/:id/staff/:role/replace': ['admin'],

  'GET /api/uploads/:file': { public: 404 },
  'GET /api/products': ['admin', 'finance', 'manager'],
  'PUT /api/products/order': ['admin', 'manager'],
  'GET /api/products/:id': ['admin', 'finance', 'manager'],
  'GET /api/products/:id/price-history': ['admin', 'finance', 'manager'],
  'POST /api/products': ['admin', 'manager'],
  'PATCH /api/products/:id': ['admin', 'manager'],
  'PATCH /api/products/:id/price': ['admin', 'finance'],

  'GET /api/showroom/products': ['kiosk'],
  'POST /api/showroom/orders': ['kiosk'],

  'GET /api/orders': ['admin', 'finance', 'manager', 'cashier'],
  'GET /api/orders/:id': ['admin', 'finance', 'manager', 'cashier'],
  'PATCH /api/orders/:id': ['admin', 'cashier'],
  'POST /api/orders/:id/confirm': ['admin', 'cashier'],
  'POST /api/orders/:id/cancel': ['admin', 'cashier'],
  'GET /api/orders/:id/receipt': ['admin', 'cashier'],

  'GET /api/public/products': { public: 200 },

  'GET /api/activity': ['admin'],
  'GET /api/activity/actions': ['admin'],
};

const fillPath = (path: string) =>
  path
    .replace(':role/permissions', 'CASHIER/permissions')
    .replace('staff/:role', 'staff/manager')
    .replace(':file', 'missing.webp')
    .replace(/:id/g, randomUUID());

describe('RBAC matrix: every route × every caller', () => {
  let t: TestApp;
  const tokens: Partial<Record<Caller, string>> = {};

  beforeAll(async () => {
    t = await createTestApp();
    await seedWorld(t.prisma);
    tokens.admin = (await login(t, 'admin', PW.admin)).token;
    tokens.finance = (await login(t, 'finance', PW.finance)).token;
    tokens.manager = (await login(t, 'gh.manager', PW.manager)).token;
    tokens.cashier = (await login(t, 'gh.cashier', PW.cashier)).token;
    tokens.kiosk = (await showroomLogin(t, 'gh.manager', PW.showroom)).token;
  });
  afterAll(async () => {
    await t.close();
  });

  it('the matrix lists exactly the routes the app exposes', () => {
    const actual = appRoutes(t).map((r) => `${r.method} ${r.path}`).sort();
    expect(Object.keys(MATRIX).sort()).toEqual(actual);
  });

  const cases = Object.entries(MATRIX).flatMap(([route, rule]) => ALL.map((caller) => [route, caller, rule] as const));

  it.each(cases)('%s as %s', async (route, caller, rule) => {
    const [method, path] = route.split(' ');
    let req = t
      .http()
      [method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'](fillPath(path))
      .set(csrf);
    const token = tokens[caller];
    if (token) req = req.set(bearer(token));
    const res = method === 'GET' || method === 'DELETE' ? await req : await req.send({});

    if (!Array.isArray(rule)) {
      expect(res.status).toBe(rule.public);
    } else if (rule.includes(caller)) {
      expect([401, 403]).not.toContain(res.status);
      expect(res.status).toBeLessThan(500);
    } else {
      expect(res.status).toBe(caller === 'anon' ? 401 : 403);
    }
  });
});
