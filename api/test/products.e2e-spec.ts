import sharp from 'sharp';
import { createTestApp, type TestApp } from './utils/app';
import { bearer, login } from './utils/auth';
import { PW, seedWorld, type World } from './utils/fixtures';

const pngImage = (color = '#d9541a') =>
  sharp({ create: { width: 320, height: 240, channels: 3, background: color } }).png().toBuffer();

describe('Products & pricing (e2e)', () => {
  let t: TestApp;
  let world: World;
  let tokens: Record<'admin' | 'finance' | 'bo' | 'gh' | 'cashier', string>;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    world = await seedWorld(t.prisma);
    tokens = {
      admin: (await login(t, 'admin', PW.admin)).token,
      finance: (await login(t, 'finance', PW.finance)).token,
      bo: (await login(t, 'bo.manager', PW.manager)).token,
      gh: (await login(t, 'gh.manager', PW.manager)).token,
      cashier: (await login(t, 'gh.cashier', PW.cashier)).token,
    };
  });
  afterAll(async () => {
    await t.close();
  });

  const createProduct = async (token: string, fields: Record<string, string>, image?: Buffer | null, filename = 'photo.png') => {
    let req = t.http().post('/api/products').set(bearer(token));
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    if (image !== null) req = req.attach('image', image ?? (await pngImage()), filename);
    return req;
  };

  describe('Branch Manager', () => {
    it('creates a product with name + image (+ optional barcode/description) and no price', async () => {
      const res = await createProduct(tokens.gh, { name: 'Sun Shade', barcode: 'SS-100', description: 'Foldable windshield shade' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Sun Shade', barcode: 'SS-100', price: null, createdBy: { displayName: 'GH Manager' } });
      expect(res.body.imageUrl).toMatch(/^\/api\/uploads\/[0-9a-f-]{36}\.webp$/);

      const img = await t.http().get(res.body.imageUrl);
      expect(img.status).toBe(200);
      expect(img.headers['content-type']).toBe('image/webp');
      expect(img.headers['x-content-type-options']).toBe('nosniff');

      // shared catalogue: appended to the end of every branch's showroom order
      for (const b of [world.bo, world.gh]) {
        const last = await t.prisma.branchProduct.findFirstOrThrow({ where: { branchId: b.id }, orderBy: { position: 'desc' } });
        expect(last.productId).toBe(res.body.id);
      }
      expect(await t.prisma.activityLog.count({ where: { action: 'product.create', entityId: res.body.id } })).toBe(1);
    });

    it('cannot set a price when creating (400) or through the price endpoint (403)', async () => {
      const create = await createProduct(tokens.gh, { name: 'Sneaky', price: '10' });
      expect(create.status).toBe(400);
      expect(create.body.errors).toEqual([{ field: 'price', messages: ['property price should not exist'] }]);
      expect(await t.prisma.product.count({ where: { name: 'Sneaky' } })).toBe(0);

      const edit = await t.http().patch(`/api/products/${world.products[0].id}`).set(bearer(tokens.gh)).field('price', '1');
      expect(edit.status).toBe(400);
      const price = await t.http().patch(`/api/products/${world.products[0].id}/price`).set(bearer(tokens.gh)).send({ price: '1' });
      expect(price.status).toBe(403);
      expect((await t.prisma.product.findUniqueOrThrow({ where: { id: world.products[0].id } })).price?.toFixed(2)).toBe('499.00');
    });

    it('requires a name and an image, and validates the barcode', async () => {
      expect((await createProduct(tokens.gh, { name: 'No image' }, null)).body.code).toBe('IMAGE_REQUIRED');
      const bad = await createProduct(tokens.gh, { name: 'x', barcode: 'has spaces!' });
      expect(bad.status).toBe(400);
      expect(bad.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['barcode', 'name']);
      const dup = await createProduct(tokens.gh, { name: 'Duplicate', barcode: '1000000000001' });
      expect(dup.status).toBe(409);
      expect(dup.body.message).toBe('Another product already uses this barcode.');
      // the activity log records what the client received, not a generic 500
      const logged = await t.prisma.activityLog.findFirstOrThrow({
        where: { action: 'product.create', outcome: 'FAILURE', requestId: dup.body.requestId },
      });
      expect(logged.metadata).toMatchObject({ status: 409, reason: 'DUPLICATE' });
    });

    it('rejects spoofed, unsupported and oversize uploads', async () => {
      const fake = await createProduct(tokens.gh, { name: 'Fake' }, Buffer.from('#!/bin/sh\nrm -rf /\n'.repeat(50)), 'evil.jpg');
      expect(fake.status).toBe(400);
      expect(fake.body.code).toBe('UNSUPPORTED_IMAGE');
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><script>alert(1)</script></svg>');
      expect((await createProduct(tokens.gh, { name: 'Svg' }, svg, 'x.png')).body.code).toBe('UNSUPPORTED_IMAGE');
      const huge = Buffer.concat([await pngImage(), Buffer.alloc(5 * 1024 * 1024 + 10)]);
      const big = await createProduct(tokens.gh, { name: 'Huge' }, huge, 'big.png');
      expect(big.status).toBe(413);
      expect(big.body.code).toBe('FILE_TOO_LARGE');
      expect(await t.prisma.product.count({ where: { name: { in: ['Fake', 'Svg', 'Huge'] } } })).toBe(0);
    });

    it('edits name, image, barcode and description', async () => {
      const id = world.products[1].id;
      const res = await t
        .http()
        .patch(`/api/products/${id}`)
        .set(bearer(tokens.bo))
        .field('name', 'Premium Floor Mats')
        .field('barcode', '')
        .field('description', 'All-weather')
        .attach('image', await pngImage('#161616'), 'mats.png');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Premium Floor Mats', barcode: null, description: 'All-weather', price: '120.50' });
      expect(res.body.imageUrl).not.toContain('00000000-0000-4000-8000-000000000000');
      const log = await t.prisma.activityLog.findFirstOrThrow({ where: { action: 'product.update', entityId: id } });
      expect(log.before).toMatchObject({ name: 'Floor Mats' });
      expect(log.after).toMatchObject({ name: 'Premium Floor Mats', barcode: null });
    });

    it('sees prices (read-only) in their branch order', async () => {
      const res = await t.http().get('/api/products').set(bearer(tokens.gh));
      expect(res.status).toBe(200);
      expect(res.body.map((p: { name: string }) => p.name)).toEqual(['Dash Cam', 'Floor Mats', 'Phone Holder']);
      expect(res.body[0]).toMatchObject({ price: '499.00', barcode: '1000000000001', position: 0 });
      expect(res.body[2].price).toBeNull();
    });

    it('reorders their own branch only, and the order persists', async () => {
      const [a, b, c] = world.products.map((p) => p.id);
      const res = await t.http().put('/api/products/order').set(bearer(tokens.gh)).send({ productIds: [c, a, b] });
      expect(res.status).toBe(200);
      expect(res.body.map((p: { id: string }) => p.id)).toEqual([c, a, b]);
      expect((await t.http().get('/api/products').set(bearer(tokens.gh))).body.map((p: { id: string }) => p.id)).toEqual([c, a, b]);
      // the other branch keeps its own order
      expect((await t.http().get('/api/products').set(bearer(tokens.bo))).body.map((p: { id: string }) => p.id)).toEqual([a, b, c]);

      const cross = await t.http().put('/api/products/order').set(bearer(tokens.gh)).send({ productIds: [b, a, c], branchId: world.bo.id });
      expect(cross.status).toBe(403);
      const partial = await t.http().put('/api/products/order').set(bearer(tokens.gh)).send({ productIds: [a, b] });
      expect(partial.status).toBe(400);
      expect(partial.body.code).toBe('ORDER_MISMATCH');

      const log = await t.prisma.activityLog.findFirstOrThrow({ where: { action: 'product.reorder', outcome: 'SUCCESS' } });
      expect(log).toMatchObject({ entityType: 'Branch', entityId: world.gh.id, branchId: world.gh.id });
      expect(log.after).toEqual({ productIds: [c, a, b] });
    });
  });

  describe('Finance', () => {
    it('sets and changes prices, recording history (old, new, who, when)', async () => {
      const id = world.products[2].id;
      const first = await t.http().patch(`/api/products/${id}/price`).set(bearer(tokens.finance)).send({ price: 89 });
      expect(first.status).toBe(200);
      expect(first.body.price).toBe('89.00');
      await t.http().patch(`/api/products/${id}/price`).set(bearer(tokens.finance)).send({ price: '95.5' });

      const history = await t.http().get(`/api/products/${id}/price-history`).set(bearer(tokens.finance));
      expect(history.body).toHaveLength(2);
      expect(history.body[0]).toMatchObject({ oldPrice: '89.00', newPrice: '95.50', changedBy: { username: 'finance', role: 'FINANCE' } });
      expect(history.body[1]).toMatchObject({ oldPrice: null, newPrice: '89.00' });
      // managers can read the history too (read-only)
      expect((await t.http().get(`/api/products/${id}/price-history`).set(bearer(tokens.gh))).status).toBe(200);

      const log = await t.prisma.activityLog.findFirstOrThrow({ where: { action: 'product.price.update' }, orderBy: { id: 'desc' } });
      expect(log).toMatchObject({ actorUsername: 'finance', actorRole: 'FINANCE', before: { price: '89.00' }, after: { price: '95.50' } });
    });

    it('cannot edit name, image, barcode or description — at the route and at the DTO', async () => {
      const id = world.products[0].id;
      const details = await t.http().patch(`/api/products/${id}`).set(bearer(tokens.finance)).field('name', 'Hacked');
      expect(details.status).toBe(403);

      const smuggled = await t
        .http()
        .patch(`/api/products/${id}/price`)
        .set(bearer(tokens.finance))
        .send({ price: '10', name: 'Hacked', barcode: 'X', description: 'Y', imageKey: 'Z' });
      expect(smuggled.status).toBe(400);
      expect(smuggled.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['barcode', 'description', 'imageKey', 'name']);

      const row = await t.prisma.product.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ name: 'Dash Cam', barcode: '1000000000001' });
      expect(row.price?.toFixed(2)).toBe('499.00');
      expect((await createProduct(tokens.finance, { name: 'Finance product' })).status).toBe(403);
      expect((await t.http().put('/api/products/order').set(bearer(tokens.finance)).send({ productIds: [] })).status).toBe(403);
    });

    it.each([['-5'], ['1.999'], ['abc'], ['10000000'], [null]])('rejects invalid price %p', async (price) => {
      const res = await t.http().patch(`/api/products/${world.products[0].id}/price`).set(bearer(tokens.finance)).send({ price });
      expect(res.status).toBe(400);
      expect(res.body.errors[0].field).toBe('price');
    });

    it('lists the catalogue by name with an "unpriced" filter', async () => {
      const res = await t.http().get('/api/products?price=unpriced').set(bearer(tokens.finance));
      expect(res.body.map((p: { name: string }) => p.name)).toEqual(['Phone Holder']);
    });
  });

  describe('other roles', () => {
    it('cashiers have no product management access by default', async () => {
      expect((await t.http().get('/api/products').set(bearer(tokens.cashier))).status).toBe(403);
      expect((await createProduct(tokens.cashier, { name: 'x' })).status).toBe(403);
    });

    it('super admin edits everything and reorders a chosen branch', async () => {
      const id = world.products[0].id;
      expect((await t.http().patch(`/api/products/${id}`).set(bearer(tokens.admin)).field('name', 'Admin edit')).status).toBe(200);
      expect((await t.http().patch(`/api/products/${id}/price`).set(bearer(tokens.admin)).send({ price: '1' })).status).toBe(200);
      const ids = world.products.map((p) => p.id).reverse();
      expect((await t.http().put('/api/products/order').set(bearer(tokens.admin)).send({ productIds: ids })).body.code).toBe(
        'BRANCH_REQUIRED',
      );
      const res = await t.http().put('/api/products/order').set(bearer(tokens.admin)).send({ productIds: ids, branchId: world.bo.id });
      expect(res.status).toBe(200);
    });
  });

  describe('uploads endpoint', () => {
    it('only serves generated filenames', async () => {
      for (const path of ['/api/uploads/..%2F..%2F.env', '/api/uploads/passwd', '/api/uploads/abc.webp', '/api/uploads/00000000-0000-4000-8000-00000000abcd.webp']) {
        expect((await t.http().get(path)).status).toBe(404);
      }
    });
  });
});
