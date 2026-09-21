import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { ImageUploadService } from '../uploads/image-upload.service';
import { ProductsService } from './products.service';

const product = (o: Record<string, unknown> = {}) => ({
  id: 'p-1',
  name: 'Dash Cam',
  description: null,
  barcode: null,
  imageKey: '11111111-1111-4111-8111-111111111111',
  price: null,
  priceUpdatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: 'm', displayName: 'Manager' },
  ...o,
});

describe('ProductsService', () => {
  const prisma = mockDeep<PrismaService>();
  const images = mock<ImageUploadService>();
  const trail = mock<AuditTrail>();
  const service = new ProductsService(prisma, images, trail);
  const manager = authUser({ role: 'BRANCH_MANAGER', branchId: 'b-1' }, ['product.create', 'product.reorder']);
  const finance = authUser({ role: 'FINANCE', branchId: null }, ['product.update.price']);

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'setBranch'] as const) trail[m].mockReturnValue(trail);
    prisma.$transaction.mockImplementation((fn: unknown) => (fn as (tx: unknown) => unknown)(prisma) as never);
    prisma.product.findUnique.mockResolvedValue(product() as never);
  });

  describe('create', () => {
    it('stores the image, creates the product without a price and appends it to every branch', async () => {
      images.store.mockResolvedValue('22222222-2222-4222-8222-222222222222');
      prisma.product.create.mockResolvedValue({ id: 'p-1' } as never);
      await service.create({ name: 'Dash Cam' }, { buffer: Buffer.alloc(1), size: 1 }, manager);
      const data = prisma.product.create.mock.calls[0][0].data as Record<string, unknown>;
      expect(data).toMatchObject({ name: 'Dash Cam', imageKey: '22222222-2222-4222-8222-222222222222', createdById: 'u-1' });
      expect(data).not.toHaveProperty('price');
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(String((prisma.$executeRaw.mock.calls[0][0] as TemplateStringsArray).join('?'))).toContain('INSERT INTO branch_products');
    });

    it('deletes the stored image if the database write fails', async () => {
      images.store.mockResolvedValue('33333333-3333-4333-8333-333333333333');
      prisma.product.create.mockRejectedValue(new Error('duplicate barcode'));
      await expect(service.create({ name: 'X', barcode: 'B1' }, { buffer: Buffer.alloc(1), size: 1 }, manager)).rejects.toThrow();
      expect(images.remove).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333');
    });
  });

  describe('updateDetails', () => {
    it('only writes detail fields (never the price)', async () => {
      prisma.product.findUniqueOrThrow.mockResolvedValue({ imageKey: 'old' } as never);
      await service.updateDetails('p-1', { name: 'New name', barcode: null }, undefined, manager);
      const data = prisma.product.update.mock.calls[0][0].data as Record<string, unknown>;
      expect(data).toEqual({ name: 'New name', barcode: null, updatedById: 'u-1' });
    });

    it('swaps images and deletes the old files', async () => {
      prisma.product.findUniqueOrThrow.mockResolvedValue({ imageKey: 'old-key' } as never);
      images.store.mockResolvedValue('new-key');
      await service.updateDetails('p-1', {}, { buffer: Buffer.alloc(1), size: 1 }, manager);
      expect(prisma.product.update.mock.calls[0][0].data).toMatchObject({ imageKey: 'new-key' });
      expect(images.remove).toHaveBeenCalledWith('old-key');
    });

    it('rejects an empty update', async () => {
      prisma.product.findUniqueOrThrow.mockResolvedValue({ imageKey: 'k' } as never);
      await expect(service.updateDetails('p-1', {}, undefined, manager)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updatePrice', () => {
    it('writes the price and a history row with old and new values', async () => {
      prisma.$queryRaw.mockResolvedValue([{ price: new Prisma.Decimal('100.00') }] as never);
      await service.updatePrice('p-1', { price: '125.50' }, finance);
      expect(prisma.product.update.mock.calls[0][0].data).toMatchObject({ price: new Prisma.Decimal('125.5'), updatedById: 'u-1' });
      const history = prisma.priceHistory.create.mock.calls[0][0].data as { oldPrice: Prisma.Decimal; newPrice: Prisma.Decimal };
      expect(history.oldPrice.toFixed(2)).toBe('100.00');
      expect(history.newPrice.toFixed(2)).toBe('125.50');
      expect(trail.setChange).toHaveBeenCalledWith({ price: '100.00' }, { price: '125.50' });
    });

    it('does not write history when the price is unchanged', async () => {
      prisma.$queryRaw.mockResolvedValue([{ price: new Prisma.Decimal('99.9') }] as never);
      await service.updatePrice('p-1', { price: '99.90' }, finance);
      expect(prisma.priceHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    beforeEach(() => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'b-1' }] as never);
      prisma.branchProduct.findMany
        .mockResolvedValueOnce([{ productId: 'a' }, { productId: 'b' }, { productId: 'c' }] as never)
        .mockResolvedValue([] as never);
    });

    it("uses the caller's branch and refuses another branch", async () => {
      await expect(service.reorder(manager, { productIds: ['a'], branchId: 'b-2' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('requires the exact set of branch products', async () => {
      await expect(service.reorder(manager, { productIds: ['a', 'b'] })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.reorder(manager, { productIds: ['a', 'b', 'c', 'x'] })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rewrites all positions in one statement and audits the change', async () => {
      await service.reorder(manager, { productIds: ['c', 'a', 'b'] });
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(prisma.$executeRaw.mock.calls[0]).toContainEqual(['c', 'a', 'b']);
      expect(trail.setChange).toHaveBeenCalledWith({ productIds: ['a', 'b', 'c'] }, { productIds: ['c', 'a', 'b'] });
    });

    it('asks users without a branch to choose one', async () => {
      const admin = authUser({ role: 'SUPER_ADMIN', branchId: null });
      await expect(service.reorder(admin, { productIds: [] })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
