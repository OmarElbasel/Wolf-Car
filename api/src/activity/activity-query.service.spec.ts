import { mock, mockDeep } from 'jest-mock-extended';
import type { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { PrismaService } from '../prisma/prisma.service';
import { ActivityQueryService } from './activity-query.service';

describe('ActivityQueryService', () => {
  const prisma = mockDeep<PrismaService>();
  const discovery = mock<DiscoveryService>();
  const service = new ActivityQueryService(prisma, discovery, mock<MetadataScanner>(), mock<Reflector>());

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((ops: unknown) => Promise.all(ops as unknown[]) as never);
    prisma.activityLog.count.mockResolvedValue(1);
    prisma.branch.findMany.mockResolvedValue([{ id: 'gh', code: 'GH', name: 'GH', nameAr: 'GH' }] as never);
    prisma.activityLog.findMany.mockResolvedValue([
      {
        id: BigInt(42), occurredAt: new Date(), action: 'order.confirm', outcome: 'SUCCESS', actorId: 'u', actorUsername: 'gh.cashier',
        actorRole: 'CASHIER', branchId: 'gh', entityType: 'Order', entityId: 'o', before: null, after: null, metadata: null,
        ip: '1.2.3.4', userAgent: 'x', requestId: 'r',
      },
    ] as never);
  });

  it('maps filters: action prefix, lower-cased actor, Qatar days', async () => {
    await service.list({ page: 2, pageSize: 10, action: 'order.', actor: 'GH.Cash', from: '2026-09-01', to: '2026-09-02', outcome: 'SUCCESS' });
    const args = prisma.activityLog.findMany.mock.calls[0][0];
    expect(args).toMatchObject({ orderBy: { id: 'desc' }, skip: 10, take: 10 });
    expect((args?.where as { AND: unknown[] }).AND).toEqual([
      { actorUsername: { contains: 'gh.cash' } },
      { action: { startsWith: 'order.' } },
      { outcome: 'SUCCESS' },
      { occurredAt: { gte: new Date('2026-08-31T21:00:00.000Z') } },
      { occurredAt: { lt: new Date('2026-09-02T21:00:00.000Z') } },
    ]);
  });

  it('serialises bigint ids and attaches branch details', async () => {
    const page = await service.list({ page: 1, pageSize: 20 });
    expect(page.items[0]).toMatchObject({ id: '42', branch: { code: 'GH' }, actor: { username: 'gh.cashier', role: 'CASHIER' } });
  });

  it('builds the action list from route metadata plus the extra actions', () => {
    discovery.getControllers.mockReturnValue([]);
    service.onApplicationBootstrap();
    expect(service.knownActions()).toEqual(['access.denied', 'auth.refresh.reuse_detected']);
  });
});
