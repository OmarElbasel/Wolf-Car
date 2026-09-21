import { NotFoundException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { isStrongPassword } from '../../../shared/validation';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PasswordService } from '../auth/password.service';
import type { TokenService } from '../auth/token.service';
import type { PrismaService } from '../prisma/prisma.service';
import { BranchesService } from './branches.service';

const branchRow = (users: { id: string; role: string }[] = []) => ({
  id: 'b-1',
  code: 'WK',
  name: 'Al Wakra',
  nameAr: 'الوكرة',
  isActive: true,
  createdAt: new Date(),
  users: users.map((u) => ({ username: `${u.id}`, displayName: u.id, email: null, isActive: true, ...u })),
});

describe('BranchesService', () => {
  const prisma = mockDeep<PrismaService>();
  const passwords = mock<PasswordService>();
  const tokens = mock<TokenService>();
  const trail = mock<AuditTrail>();
  const service = new BranchesService(prisma, passwords, tokens, trail);
  const admin = authUser({ id: 'admin', role: 'SUPER_ADMIN', branchId: null });

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'setBranch'] as const) trail[m].mockReturnValue(trail);
    passwords.hash.mockResolvedValue('hash');
    prisma.$transaction.mockImplementation((fn: unknown) => (fn as (tx: unknown) => unknown)(prisma) as never);
  });

  it('creates the branch, both staff accounts and the showroom order in one transaction', async () => {
    prisma.branch.create.mockResolvedValue({ id: 'b-1', code: 'WK' } as never);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create
      .mockResolvedValueOnce({ id: 'm', username: 'wk.manager', displayName: 'M', role: 'BRANCH_MANAGER' } as never)
      .mockResolvedValueOnce({ id: 'c', username: 'wk.cashier', displayName: 'C', role: 'CASHIER' } as never);
    prisma.product.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }] as never);
    prisma.branch.findUnique.mockResolvedValue(branchRow([{ id: 'm', role: 'BRANCH_MANAGER' }, { id: 'c', role: 'CASHIER' }]) as never);

    const result = await service.create(
      { code: 'WK', name: 'Al Wakra', nameAr: 'الوكرة', manager: { displayName: 'M' }, cashier: { displayName: 'C' } },
      admin,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.credentials.map((c) => c.username)).toEqual(['wk.manager', 'wk.cashier']);
    for (const c of result.credentials) {
      expect(isStrongPassword(c.password ?? '')).toBe(true);
      expect(isStrongPassword(c.showroomPassword ?? '')).toBe(true);
      expect(c.password).not.toBe(c.showroomPassword);
    }
    expect(prisma.branchProduct.createMany).toHaveBeenCalledWith({
      data: [
        { branchId: 'b-1', productId: 'p1', position: 0 },
        { branchId: 'b-1', productId: 'p2', position: 1 },
      ],
    });
    expect(result.branch.manager?.id).toBe('m');
  });

  it('replaces staff by retiring the current account in the same transaction', async () => {
    prisma.branch.findUnique.mockResolvedValue(branchRow([{ id: 'old', role: 'CASHIER' }, { id: 'm', role: 'BRANCH_MANAGER' }]) as never);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'new', username: 'wk.cashier.x7k2', displayName: 'N', role: 'CASHIER' } as never);
    const { credentials } = await service.replaceStaff('b-1', 'CASHIER', { displayName: 'N' }, admin);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'old' }, data: { deletedAt: expect.any(Date), isActive: false } });
    expect(tokens.revokeUserSessions).toHaveBeenCalledWith('old', 'replaced', {}, prisma);
    expect(credentials).toMatchObject({ userId: 'new', role: 'CASHIER', branchCode: 'WK' });
  });

  it('404s for unknown branches', async () => {
    prisma.branch.findUnique.mockResolvedValue(null);
    await expect(service.get('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
