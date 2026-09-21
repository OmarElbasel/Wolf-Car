import { mockDeep } from 'jest-mock-extended';
import type { PrismaService } from '../prisma/prisma.service';
import { PublicCatalogService } from './public-catalog.service';

describe('PublicCatalogService', () => {
  const prisma = mockDeep<PrismaService>();
  const service = new PublicCatalogService(prisma);

  it('never selects price or barcode and returns only public fields', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p', name: 'Dash Cam', description: null, imageKey: '11111111-1111-4111-8111-111111111111' },
    ] as never);
    const items = await service.list();
    const select = prisma.product.findMany.mock.calls[0][0]?.select as Record<string, boolean>;
    expect(Object.keys(select).sort()).toEqual(['description', 'id', 'imageKey', 'name']);
    expect(Object.keys(items[0]).sort()).toEqual(['description', 'id', 'imageUrl', 'name', 'thumbUrl']);
  });
});
