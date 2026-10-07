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
