import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import { OrderLockedException } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

const orderRow = (status = 'PENDING') => ({
  id: 'o-1',
  code: 'GH-000001',
  number: 1,
  status,
  customerName: 'Sara',
  total: new Prisma.Decimal('300'),
  currency: 'QAR',
  createdAt: new Date(),
  updatedAt: new Date(),
  confirmedAt: null,
  cancelledAt: null,
  branch: { id: 'gh', code: 'GH', name: 'GH', nameAr: 'GH' },
  createdBy: { id: 'm', username: 'gh.manager', displayName: 'M' },
  confirmedBy: null,
  cancelledBy: null,
  _count: { items: 2 },
  items: [
    { id: 'i1', productId: 'p1', productName: 'A', unitPrice: new Prisma.Decimal('100'), quantity: 2, lineTotal: new Prisma.Decimal('200'), product: { imageKey: 'k', barcode: null } },
    { id: 'i2', productId: 'p2', productName: 'B', unitPrice: new Prisma.Decimal('50'), quantity: 2, lineTotal: new Prisma.Decimal('100'), product: { imageKey: 'k', barcode: null } },
  ],
});

describe('OrdersService', () => {
  const prisma = mockDeep<PrismaService>();
  const trail = mock<AuditTrail>();
  const service = new OrdersService(prisma, trail);
  const cashier = authUser({ role: 'CASHIER', branchId: 'gh' }, ['order.read.branch', 'order.update', 'order.confirm']);
  const admin = authUser({ role: 'SUPER_ADMIN', branchId: null });

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'setBranch', 'addMetadata'] as const) trail[m].mockReturnValue(trail);
    prisma.$transaction.mockImplementation((arg: unknown) =>
      (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[])) as never,
    );
  });

  it('always applies the branch scope to lists, whatever branchId is requested', async () => {
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);
    await service.list(cashier, { page: 1, pageSize: 20, branchId: 'bo', status: 'PENDING', orderNumber: 'gh-000042' });
    const where = prisma.order.findMany.mock.calls[0][0]?.where as { AND: unknown[] };
    expect(where.AND).toContainEqual({ branchId: 'gh' });
    expect(where.AND).not.toContainEqual({ branchId: 'bo' });
    expect(where.AND).toContainEqual({ code: 'GH-000042' });
    expect(where.AND).toContainEqual({ status: 'PENDING' });
  });

  it('interprets date-only filters as Qatar calendar days (inclusive)', async () => {
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);
    await service.list(admin, { page: 1, pageSize: 20, from: '2026-09-01', to: '2026-09-01' });
    const where = prisma.order.findMany.mock.calls[0][0]?.where as { AND: unknown[] };
    expect(where.AND).toContainEqual({ createdAt: { gte: new Date('2026-08-31T21:00:00.000Z') } });
    expect(where.AND).toContainEqual({ createdAt: { lt: new Date('2026-09-01T21:00:00.000Z') } });
  });

  it('404s for orders outside the scope', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(service.get(cashier, 'o-bo')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.findFirst.mock.calls[0][0]?.where).toEqual({ AND: [{ id: 'o-bo' }, { branchId: 'gh' }] });
  });

  it('refuses to edit confirmed orders for everyone but the Super Admin', async () => {
    prisma.order.findFirst.mockResolvedValue(orderRow('CONFIRMED') as never);
    await expect(service.update(cashier, 'o-1', { customerName: 'X' })).rejects.toBeInstanceOf(OrderLockedException);
    expect(prisma.order.update).not.toHaveBeenCalled();

    prisma.$queryRaw.mockResolvedValue([{ status: 'CONFIRMED' }] as never);
    await service.update(admin, 'o-1', { customerName: 'X' });
    expect(prisma.order.update).toHaveBeenCalled();
    expect(trail.addMetadata).toHaveBeenCalledWith({ override: true, status: 'CONFIRMED' });
  });

  it('re-checks the status under a row lock (confirm/edit race)', async () => {
    prisma.order.findFirst.mockResolvedValue(orderRow('PENDING') as never);
    prisma.$queryRaw.mockResolvedValue([{ status: 'CONFIRMED' }] as never);
    await expect(service.update(cashier, 'o-1', { customerName: 'X' })).rejects.toBeInstanceOf(OrderLockedException);
  });

  it('recomputes totals from the snapshotted unit prices and removes omitted lines', async () => {
    prisma.order.findFirst.mockResolvedValue(orderRow() as never);
    prisma.$queryRaw.mockResolvedValue([{ status: 'PENDING' }] as never);
    await service.update(cashier, 'o-1', { items: [{ productId: 'p1', quantity: 3 }] });
    expect(prisma.orderItem.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'o-1', productId: { notIn: ['p1'] } } });
    expect((prisma.orderItem.update.mock.calls[0][0].data as { lineTotal: Prisma.Decimal }).lineTotal.toFixed(2)).toBe('300.00');
    expect((prisma.order.update.mock.calls[0][0].data as { total: Prisma.Decimal }).total.toFixed(2)).toBe('300.00');
  });

  it('rejects lines that are not on the order', async () => {
    prisma.order.findFirst.mockResolvedValue(orderRow() as never);
    prisma.$queryRaw.mockResolvedValue([{ status: 'PENDING' }] as never);
    await expect(service.update(cashier, 'o-1', { items: [{ productId: 'new', quantity: 1 }] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('confirms with one conditional update and reports 409 when no longer pending', async () => {
    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.order.findFirst.mockResolvedValue(orderRow('CONFIRMED') as never);
    await service.confirm(cashier, 'o-1');
    expect(prisma.order.updateMany.mock.calls[0][0].where).toEqual({ AND: [{ id: 'o-1' }, { branchId: 'gh' }, { status: { in: ['PENDING'] } }] });
    expect(trail.setChange).toHaveBeenCalledWith({ status: 'PENDING' }, { status: 'CONFIRMED' });

    prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.confirm(cashier, 'o-1')).rejects.toBeInstanceOf(OrderLockedException);
  });

  it('lets only the Super Admin cancel a confirmed order', async () => {
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findFirst.mockResolvedValue(orderRow('CANCELLED') as never);
    await service.cancel(admin, 'o-1');
    expect(prisma.order.updateMany.mock.calls[0][0].where).toEqual({ AND: [{ id: 'o-1' }, {}, { status: { in: ['PENDING', 'CONFIRMED'] } }] });
  });
});
