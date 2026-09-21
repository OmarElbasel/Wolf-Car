import { createTestApp, type TestApp } from './utils/app';
import { bearer, login, showroomLogin } from './utils/auth';
import { PW, seedWorld, type World } from './utils/fixtures';
import { pdfText } from './utils/pdf';

const binary = (res: { on: (e: string, cb: (c?: Buffer) => void) => void }, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c?: Buffer) => c && chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('Receipts (e2e)', () => {
  let t: TestApp;
  let world: World;
  let cashier: string;
  let order: { id: string; code: string };

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    world = await seedWorld(t.prisma);
    const kiosk = await showroomLogin(t, 'gh.cashier', PW.showroom);
    order = (
      await t
        .http()
        .post('/api/showroom/orders')
        .set(bearer(kiosk.token))
        .send({
          items: [
            { productId: world.products[0].id, quantity: 2 },
            { productId: world.products[1].id, quantity: 1 },
          ],
          customerName: 'Sara Al-Mansouri',
          userId: (kiosk.body.user as { id: string }).id,
        })
    ).body;
    cashier = (await login(t, 'gh.cashier', PW.cashier)).token;
  });
  afterAll(async () => {
    await t.close();
  });

  const download = (token: string, id: string, locale = 'en') =>
    t.http().get(`/api/orders/${id}/receipt?locale=${locale}`).set(bearer(token)).buffer(true).parse(binary);

  it('is only available once the order is confirmed', async () => {
    const res = await download(cashier, order.id);
    expect(res.status).toBe(409);
    expect(JSON.parse((res.body as Buffer).toString()).code).toBe('ORDER_NOT_CONFIRMED');
  });

  it('downloads a PDF with branch, number, date, customer, lines and grand total', async () => {
    await t.http().post(`/api/orders/${order.id}/confirm`).set(bearer(cashier));
    const res = await download(cashier, order.id);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="receipt-GH-000001.pdf"');
    expect(res.headers['cache-control']).toBe('no-store');
    const pdf = res.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');

    const text = pdfText(pdf);
    for (const part of ['GH-000001', 'GH Branch', 'Sara Al-Mansouri', 'Dash Cam', 'Floor Mats', 'QAR 499.00', 'QAR 998.00', 'QAR 120.50', 'QAR 1,118.50', 'Grand total']) {
      expect(text).toContain(part);
    }
    expect(text).toMatch(/\b2026\b|\b20\d\d\b/);

    const log = await t.prisma.activityLog.findFirstOrThrow({ where: { action: 'order.receipt.download', outcome: 'SUCCESS' } });
    expect(log).toMatchObject({ entityType: 'Order', entityId: order.id, actorUsername: 'gh.cashier', branchId: world.gh.id });
    expect(log.metadata).toMatchObject({ code: 'GH-000001', locale: 'en' });
  }, 60_000);

  it('renders the Arabic receipt', async () => {
    await t.http().post(`/api/orders/${order.id}/confirm`).set(bearer(cashier));
    const res = await download(cashier, order.id, 'ar');
    expect(res.status).toBe(200);
    const text = pdfText(res.body as Buffer);
    expect(text).toContain('GH-000001');
    expect(text).toMatch(/[؀-ۿ]/); // Arabic glyphs present
  }, 60_000);

  it('is branch-scoped (404) and permission-gated (403)', async () => {
    await t.http().post(`/api/orders/${order.id}/confirm`).set(bearer(cashier));
    const bo = (await login(t, 'bo.cashier', PW.cashier)).token;
    expect((await download(bo, order.id)).status).toBe(404);
    const manager = (await login(t, 'gh.manager', PW.manager)).token;
    expect((await download(manager, order.id)).status).toBe(403);
    const admin = (await login(t, 'admin', PW.admin)).token;
    expect((await download(admin, order.id)).status).toBe(200);
  }, 60_000);
});
