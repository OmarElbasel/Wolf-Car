import { mockDeep } from 'jest-mock-extended';
import type { PrismaService } from '../prisma/prisma.service';
import { SessionUserService } from './session-user.service';

const session = (o: Record<string, unknown> = {}, user: Record<string, unknown> = {}) => ({
  userId: 'u-1',
  audience: 'DASHBOARD',
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user: {
    id: 'u-1', username: 'gh.cashier', displayName: 'C', role: 'CASHIER', branchId: 'gh', isActive: true, deletedAt: null,
    permissionOverrides: [{ permissionKey: 'order.read.all', effect: 'GRANT' }],
    ...user,
  },
  ...o,
});

describe('SessionUserService', () => {
  const prisma = mockDeep<PrismaService>();
  const service = new SessionUserService(prisma);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.rolePermission.findMany.mockResolvedValue([{ permissionKey: 'order.read.branch' }] as never);
  });

  it('builds the principal with effective permissions', async () => {
    prisma.session.findUnique.mockResolvedValue(session() as never);
    const user = await service.load('s-1', 'u-1', 'DASHBOARD');
    expect(user).toMatchObject({ id: 'u-1', role: 'CASHIER', branchId: 'gh', sessionId: 's-1' });
    expect([...(user?.permissions ?? [])].sort()).toEqual(['order.read.all', 'order.read.branch']);
  });

  it.each([
    ['revoked session', session({ revokedAt: new Date() })],
    ['expired session', session({ expiresAt: new Date(Date.now() - 1) })],
    ['other audience', session({ audience: 'SHOWROOM' })],
    ['other user', session({ userId: 'someone' })],
    ['deactivated user', session({}, { isActive: false })],
    ['deleted user', session({}, { deletedAt: new Date() })],
  ])('rejects a %s', async (_label, row) => {
    prisma.session.findUnique.mockResolvedValue(row as never);
    await expect(service.load('s-1', 'u-1', 'DASHBOARD')).resolves.toBeNull();
  });
});
