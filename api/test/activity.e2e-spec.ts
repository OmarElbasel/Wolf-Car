import { createTestApp, type TestApp } from './utils/app';
import { bearer, login, showroomLogin } from './utils/auth';
import { PW, seedWorld, type World } from './utils/fixtures';

describe('Activity log (e2e)', () => {
  let t: TestApp;
  let world: World;
  let admin: string;

  beforeAll(async () => {
    t = await createTestApp();
    world = await seedWorld(t.prisma);
    // a realistic trail: logins (one failed), a price change, an order, a confirmation
    await t.http().post('/api/auth/login').send({ username: 'finance', password: 'Wrong#Pass1234' });
    const finance = (await login(t, 'finance', PW.finance)).token;
    await t.http().patch(`/api/products/${world.products[2].id}/price`).set(bearer(finance)).send({ price: '75' });
    const kiosk = await showroomLogin(t, 'gh.cashier', PW.showroom);
    const order = await t
      .http()
      .post('/api/showroom/orders')
      .set(bearer(kiosk.token))
      .send({ items: [{ productId: world.products[2].id, quantity: 2 }], customerName: 'Sara', userId: (kiosk.body.user as { id: string }).id });
    const cashier = (await login(t, 'gh.cashier', PW.cashier)).token;
    await t.http().post(`/api/orders/${order.body.id}/confirm`).set(bearer(cashier)).set('User-Agent', 'Mozilla/5.0 (iPad) e2e');
    admin = (await login(t, 'admin', PW.admin)).token;
  });
  afterAll(async () => {
    await t.close();
  });

  const list = (qs = '') => t.http().get(`/api/activity${qs}`).set(bearer(admin));

  it('lists newest first with actor, role, branch, entity, before/after, IP and user agent', async () => {
    const res = await list('?pageSize=100');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(7);
    const confirm = res.body.items.find((e: { action: string }) => e.action === 'order.confirm');
    expect(confirm).toMatchObject({
      outcome: 'SUCCESS',
      actor: { username: 'gh.cashier', role: 'CASHIER' },
      branch: { id: world.gh.id, code: 'GH' },
      entityType: 'Order',
      before: { status: 'PENDING' },
      after: { status: 'CONFIRMED' },
      ip: expect.any(String),
      userAgent: expect.any(String),
      requestId: expect.any(String),
    });
    const ids = res.body.items.map((e: { id: string }) => Number(e.id));
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it('filters by action (exact or prefix), outcome, user, branch, entity and date range', async () => {
    const byAction = await list('?action=product.price.update');
    expect(byAction.body.items).toHaveLength(1);
    expect(byAction.body.items[0]).toMatchObject({ before: { price: null }, after: { price: '75.00' } });

    const logins = await list('?action=auth.&outcome=FAILURE');
    expect(logins.body.items.map((e: { action: string; actor: { username: string } }) => [e.action, e.actor.username])).toEqual([
      ['auth.login', 'finance'],
    ]);

    expect((await list('?actor=gh.cash')).body.items.every((e: { actor: { username: string } }) => e.actor.username === 'gh.cashier')).toBe(true);
    expect((await list(`?branchId=${world.gh.id}`)).body.items.length).toBeGreaterThanOrEqual(3);
    expect((await list(`?entityType=Product&entityId=${world.products[2].id}`)).body.total).toBe(1);
    const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    expect((await list(`?from=${today}&to=${today}`)).body.total).toBe((await list()).body.total);
    expect((await list('?to=2020-01-01')).body.total).toBe(0);
    expect((await list('?action=DROP TABLE')).status).toBe(400);
  });

  it('paginates', async () => {
    const p1 = await list('?pageSize=2&page=1');
    const p2 = await list('?pageSize=2&page=2');
    expect(p1.body.items).toHaveLength(2);
    expect(p2.body.items[0].id).not.toBe(p1.body.items[0].id);
    expect((await list('?pageSize=500')).status).toBe(400);
  });

  it('knows every action for the filter list', async () => {
    const res = await t.http().get('/api/activity/actions').set(bearer(admin));
    expect(res.body).toEqual(expect.arrayContaining(['auth.login', 'order.confirm', 'product.price.update', 'access.denied', 'user.create']));
  });

  it('is visible to the Super Admin only', async () => {
    const finance = (await login(t, 'finance', PW.finance)).token;
    expect((await t.http().get('/api/activity').set(bearer(finance))).status).toBe(403);
  });
});
