import { createTestApp, type TestApp } from './utils/app';
import { bearer, login, showroomLogin } from './utils/auth';
import { PW, seedWorld, type World } from './utils/fixtures';

describe('Showroom: scanning from the screen (e2e)', () => {
  let t: TestApp;
  let world: World;
  beforeAll(async () => {
    t = await createTestApp();
    world = await seedWorld(t.prisma);
    await t.prisma.branch.update({ where: { id: world.bo.id }, data: { scanFromScreen: true } });
  });
  afterAll(async () => {
    await t.close();
  });

  const branchOf = async (username: string) => {
    const kiosk = await showroomLogin(t, username, PW.showroom);
    const res = await t.http().get('/api/showroom/products').set(bearer(kiosk.token));
    expect(res.status).toBe(200);
    return res.body.branch as { code: string; scanFromScreen: boolean };
  };

  it('tells the kiosk of a branch whose cashier scans barcodes off the screen', async () => {
    expect(await branchOf('bo.cashier')).toMatchObject({ code: 'BO', scanFromScreen: true });
  });

  it('leaves every other branch as it was', async () => {
    expect(await branchOf('gh.cashier')).toMatchObject({ code: 'GH', scanFromScreen: false });
  });

  describe('a branch whose till knows a multi-colour product by one code', () => {
    let black: string;
    let beige: string;
    let plain: string;
    const codes = async (username: string) => {
      const kiosk = await showroomLogin(t, username, PW.showroom);
      const res = await t.http().get('/api/showroom/products').set(bearer(kiosk.token));
      const byId = new Map((res.body.products as { id: string; barcode: string | null }[]).map((p) => [p.id, p.barcode]));
      return { kiosk, black: byId.get(black), beige: byId.get(beige), plain: byId.get(plain) };
    };

    beforeAll(async () => {
      [black, beige, plain] = world.products.map((p) => p.id);
      await t.prisma.branch.update({ where: { id: world.gh.id }, data: { scanFromScreen: true, barcodeWithoutColour: true } });
      // two colours of one Odoo product, and a product that comes in one form
      await t.prisma.product.update({ where: { id: black }, data: { odooTemplateId: 2406, variantLabel: 'أسود', barcode: '10011100161' } });
      await t.prisma.product.update({
        where: { id: beige },
        data: { odooTemplateId: 2406, variantLabel: 'بيج', barcode: '10011100163' },
      });
      await t.prisma.product.update({ where: { id: plain }, data: { barcode: '1001050026', price: '75.00' } });
    });

    it('shows the shared code for every colour, and leaves other products alone', async () => {
      expect(await codes('gh.cashier')).toMatchObject({ black: '1001110016', beige: '1001110016', plain: '1001050026' });
    });

    it("keeps Odoo's own barcode per colour at a branch that uses Odoo", async () => {
      expect(await codes('bo.cashier')).toMatchObject({ black: '10011100161', beige: '10011100163', plain: '1001050026' });
    });

    it('puts the same code on the order the cashier scans from', async () => {
      const { kiosk } = await codes('gh.cashier');
      const order = await t
        .http()
        .post('/api/showroom/orders')
        .set(bearer(kiosk.token))
        .send({ items: [{ productId: beige, quantity: 1 }], customerName: 'Sara', userId: (kiosk.body.user as { id: string }).id });
      expect(order.status).toBe(201);
      expect(order.body.items[0].barcode).toBe('1001110016');

      const cashier = (await login(t, 'gh.cashier', PW.cashier)).token;
      const detail = await t.http().get(`/api/orders/${order.body.id}`).set(bearer(cashier));
      expect(detail.body.items[0].barcode).toBe('1001110016');
    });
  });
});
