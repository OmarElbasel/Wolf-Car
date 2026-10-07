import { Prisma } from '../src/generated/prisma/client';
import { createTestApp, type TestApp } from './utils/app';
import { bearer, showroomLogin } from './utils/auth';
import { PW, seedWorld, type World } from './utils/fixtures';

interface Listed {
  id: string;
  name: string;
  groupId: string | null;
  variantLabel: string | null;
  variantColor: string | null;
  categoryIds?: string[];
}

describe('Colour variants and brand-level products (e2e)', () => {
  let t: TestApp;
  let world: World;
  let brand: string;
  let modelA: string;
  let modelB: string;

  beforeAll(async () => {
    t = await createTestApp();
    world = await seedWorld(t.prisma);
    const category = async (name: string, parentId: string | null) =>
      (await t.prisma.category.create({ data: { name, parentId }, select: { id: true } })).id;
    brand = await category('e2e Leopard', null);
    modelA = await category('e2e Leopard 5', brand);
    modelB = await category('e2e Leopard 8', brand);

    const [dashCam, floorMats, phoneHolder] = world.products.map((p) => p.id);
    // common to the brand
    await t.prisma.product.update({ where: { id: dashCam }, data: { categoryId: brand } });
    // two colours of one product, in one model
    await t.prisma.product.update({
      where: { id: floorMats },
      data: { categoryId: modelA, odooTemplateId: 77, variantLabel: 'أسود', variantColor: '#060505' },
    });
    await t.prisma.product.update({
      where: { id: phoneHolder },
      data: { categoryId: modelA, odooTemplateId: 77, variantLabel: 'بيج', variantColor: '#d2d083', price: new Prisma.Decimal('120.50') },
    });
  });
  afterAll(async () => {
    await t.prisma.category.deleteMany({ where: { id: { in: [modelA, modelB, brand] } } });
    await t.close();
  });

  const names = (body: Listed[]) => body.map((p) => p.name).sort();

  describe('public catalogue', () => {
    it("lists a brand's products inside each of its models", async () => {
      const a = await t.http().get(`/api/public/products?categoryId=${modelA}`);
      expect(names(a.body)).toEqual(['Dash Cam', 'Floor Mats', 'Phone Holder']);
      const b = await t.http().get(`/api/public/products?categoryId=${modelB}`);
      expect(names(b.body)).toEqual(['Dash Cam']);
    });

    it('offers the models as tabs, not the brand, and counts the common products in each', async () => {
      const res = await t.http().get('/api/public/categories');
      const mine = (res.body as { id: string; count: number }[]).filter((c) => [brand, modelA, modelB].includes(c.id));
      expect(Object.fromEntries(mine.map((c) => [c.id, c.count]))).toEqual({ [modelA]: 3, [modelB]: 1 });
    });

    it('says which products are colours of the same product', async () => {
      const res = await t.http().get('/api/public/products');
      const by = new Map((res.body as Listed[]).map((p) => [p.name, p]));
      expect(by.get('Floor Mats')).toMatchObject({ groupId: '77', variantLabel: 'أسود', variantColor: '#060505' });
      expect(by.get('Phone Holder')).toMatchObject({ groupId: '77', variantLabel: 'بيج', variantColor: '#d2d083' });
      expect(by.get('Dash Cam')).toMatchObject({ groupId: null, variantLabel: null, variantColor: null });
      expect(res.text).not.toMatch(/odooTemplateId|"barcode"/);
    });
  });

  describe('showroom', () => {
    it('puts a common product in every model of its brand and leaves the brand out of the tabs', async () => {
      const kiosk = await showroomLogin(t, 'gh.cashier', PW.showroom);
      const res = await t.http().get('/api/showroom/products').set(bearer(kiosk.token));
      expect(res.status).toBe(200);
      const by = new Map((res.body.products as Listed[]).map((p) => [p.name, p]));
      expect([...(by.get('Dash Cam')?.categoryIds ?? [])].sort()).toEqual([brand, modelA, modelB].sort());
      expect(by.get('Floor Mats')?.categoryIds).toEqual([modelA]);
      expect(by.get('Floor Mats')).toMatchObject({ groupId: '77', variantLabel: 'أسود', variantColor: '#060505' });

      const tabs = (res.body.categories as { id: string; count: number }[]).filter((c) => [brand, modelA, modelB].includes(c.id));
      expect(Object.fromEntries(tabs.map((c) => [c.id, c.count]))).toEqual({ [modelA]: 3, [modelB]: 1 });
    });
  });
});
