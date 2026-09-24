import { mockDeep, mockReset } from 'jest-mock-extended';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { PublicCatalogService } from './public-catalog.service';

describe('PublicCatalogService', () => {
  const prisma = mockDeep<PrismaService>();
  const service = new PublicCatalogService(prisma);

  beforeEach(() => mockReset(prisma));

  it('never selects the barcode and returns only public fields, price included', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p',
        name: 'Dash Cam',
        description: null,
        categoryId: null,
        price: new Prisma.Decimal('499.5'),
        imageKey: '11111111-1111-4111-8111-111111111111',
      },
    ] as never);
    const items = await service.list();
    const select = prisma.product.findMany.mock.calls[0][0]?.select as Record<string, boolean>;
    expect(Object.keys(select).sort()).toEqual(['categoryId', 'description', 'id', 'imageKey', 'name', 'price']);
    expect(Object.keys(items[0]).sort()).toEqual(['categoryId', 'description', 'id', 'imageUrl', 'name', 'price', 'thumbUrl']);
    expect(items[0].price).toBe('499.50');
  });

  it('returns a null price for a product Finance has not priced yet', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p', name: 'Mats', description: null, categoryId: null, price: null, imageKey: '11111111-1111-4111-8111-111111111111' },
    ] as never);
    expect((await service.list())[0].price).toBeNull();
  });

  it('filters by an active category when one is given', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await service.list('22222222-2222-4222-8222-222222222222');
    expect(prisma.product.findMany.mock.calls[0][0]?.where).toEqual({
      categoryId: '22222222-2222-4222-8222-222222222222',
      category: { isActive: true },
    });
  });

  it('lists categories largest first with their product count', async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: 'a', name: 'الروكس', nameEn: 'Rox', carModel: 'Rox', imageKey: null, position: 0, _count: { products: 5 } },
      { id: 'b', name: 'T2', nameEn: null, carModel: 'T2', imageKey: '11111111-1111-4111-8111-111111111111', position: 0, _count: { products: 9 } },
    ] as never);
    const cats = await service.categories();
    expect(cats.map((c) => [c.id, c.count])).toEqual([
      ['b', 9],
      ['a', 5],
    ]);
    expect(cats[0].thumbUrl).toBe('/api/uploads/11111111-1111-4111-8111-111111111111-sm.webp');
    expect(cats[1].imageUrl).toBeNull();
    expect(cats.map((c) => c.nameEn)).toEqual([null, 'Rox']);
  });
});
