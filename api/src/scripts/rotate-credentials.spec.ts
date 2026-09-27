import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import type { PrismaClient } from '../generated/prisma/client';
import { rotateCredentials } from './rotate-credentials';

describe('rotateCredentials', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  const passwords = { hash: jest.fn(async (p: string) => `hash(${p})`) };
  const now = new Date('2026-09-27T12:00:00Z');
  let n: number;
  const generate = () => `pw-${++n}`;

  beforeEach(() => {
    n = 0;
    prisma = mockDeep<PrismaClient>();
    prisma.$transaction.mockImplementation((async (fn: (tx: PrismaClient) => unknown) => fn(prisma)) as never);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u-1', username: 'admin', displayName: 'Admin', role: 'SUPER_ADMIN', showroomPasswordHash: null },
      { id: 'u-2', username: 'bo.cashier', displayName: 'BO Cashier', role: 'CASHIER', showroomPasswordHash: 'old' },
    ] as never);
    prisma.session.updateMany.mockResolvedValue({ count: 3 });
  });

  it('only rotates users that are not deleted', async () => {
    await rotateCredentials(prisma, passwords, generate, now);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });

  it('gives every user a new dashboard password, and a showroom password only if they had one', async () => {
    const rows = await rotateCredentials(prisma, passwords, generate, now);
    expect(rows).toEqual([
      { username: 'admin', displayName: 'Admin', role: 'SUPER_ADMIN', password: 'pw-1', showroomPassword: null },
      { username: 'bo.cashier', displayName: 'BO Cashier', role: 'CASHIER', password: 'pw-2', showroomPassword: 'pw-3' },
    ]);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1' }, data: expect.not.objectContaining({ showroomPasswordHash: expect.anything() }) }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-2' },
        data: expect.objectContaining({ passwordHash: 'hash(pw-2)', showroomPasswordHash: 'hash(pw-3)' }),
      }),
    );
  });

  it('turns two-factor off, clears lockouts and deletes recovery codes', async () => {
    await rotateCredentials(prisma, passwords, generate, now);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: expect.objectContaining({
          twoFactorEnabled: false,
          twoFactorSecretEnc: null,
          twoFactorPendingSecretEnc: null,
          twoFactorLastStep: null,
          failedLoginCount: 0,
          lockedUntil: null,
          showroomFailedCount: 0,
          showroomLockedUntil: null,
        }),
      }),
    );
    expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1' } });
    expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-2' } });
  });

  it('signs everyone out by revoking every open session', async () => {
    await rotateCredentials(prisma, passwords, generate, now);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { revokedAt: null },
      data: { revokedAt: now, revokeReason: 'credentials_rotated' },
    });
  });
});
