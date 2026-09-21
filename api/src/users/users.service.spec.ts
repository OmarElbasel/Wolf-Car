import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { isStrongPassword } from '../../../shared/validation';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PasswordService } from '../auth/password.service';
import type { TokenService } from '../auth/token.service';
import type { TwoFactorService } from '../auth/two-factor.service';
import type { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const row = (o: Record<string, unknown> = {}) => ({
  id: 'u-2',
  username: 'finance',
  displayName: 'Finance',
  email: null,
  role: 'FINANCE',
  isActive: true,
  twoFactorEnabled: false,
  lastLoginAt: null,
  lockedUntil: null,
  showroomLockedUntil: null,
  showroomPasswordHash: null,
  createdAt: new Date(),
  branch: null,
  ...o,
});

describe('UsersService', () => {
  const prisma = mockDeep<PrismaService>();
  const passwords = mock<PasswordService>();
  const tokens = mock<TokenService>();
  const twoFactor = mock<TwoFactorService>();
  const trail = mock<AuditTrail>();
  const service = new UsersService(prisma, passwords, tokens, twoFactor, trail);
  const admin = authUser({ id: 'admin-1', role: 'SUPER_ADMIN', branchId: null });

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'setBranch', 'addMetadata'] as const) trail[m].mockReturnValue(trail);
    passwords.hash.mockResolvedValue('hash');
    prisma.$transaction.mockImplementation((fn: unknown) => (fn as (tx: unknown) => unknown)(prisma) as never);
  });

  const code = async (p: Promise<unknown>) =>
    p.then(
      () => 'resolved',
      (e: BadRequestException) => (e.getResponse() as { code?: string }).code ?? e.constructor.name,
    );

  it('creates an account with a generated username and a policy-compliant password shown once', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(row({ id: 'new', username: 'finance' }) as never);
    const { user, credentials } = await service.create({ displayName: 'Finance', role: 'FINANCE' }, admin);
    expect(user).not.toHaveProperty('passwordHash');
    expect(credentials.username).toBe('finance');
    expect(isStrongPassword(credentials.password ?? '')).toBe(true);
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ passwordHash: 'hash', createdById: 'admin-1' });
  });

  it('never changes the role of branch staff', async () => {
    prisma.user.findFirst.mockResolvedValue(row({ role: 'CASHIER', branch: { id: 'b', code: 'GH', name: 'x', nameAr: 'x' } }) as never);
    expect(await code(service.update('u-2', { role: 'FINANCE' }, admin))).toBe('BRANCH_ROLE_FIXED');
  });

  it('protects the acting admin and the last Super Admin', async () => {
    prisma.user.findFirst.mockResolvedValue(row({ id: 'admin-1', role: 'SUPER_ADMIN' }) as never);
    expect(await code(service.update('admin-1', { isActive: false }, admin))).toBe('SELF_DEACTIVATE');
    expect(await code(service.update('admin-1', { role: 'FINANCE' }, admin))).toBe('SELF_ROLE_CHANGE');

    prisma.user.findFirst.mockResolvedValue(row({ id: 'admin-2', role: 'SUPER_ADMIN' }) as never);
    prisma.user.count.mockResolvedValue(0);
    expect(await code(service.update('admin-2', { isActive: false }, admin))).toBe('LAST_ADMIN');
  });

  it('revokes sessions when an account is deactivated', async () => {
    prisma.user.findFirst.mockResolvedValue(row() as never);
    prisma.user.update.mockResolvedValue(row({ isActive: false }) as never);
    await service.update('u-2', { isActive: false }, admin);
    expect(tokens.revokeUserSessions).toHaveBeenCalledWith('u-2', 'account_changed');
  });

  it('only deletes non-branch accounts', async () => {
    prisma.user.findFirst.mockResolvedValue(row({ role: 'BRANCH_MANAGER', branch: { id: 'b', code: 'GH', name: 'x', nameAr: 'x' } }) as never);
    expect(await code(service.remove('u-2', admin))).toBe('BRANCH_STAFF');
    prisma.user.findFirst.mockResolvedValue(row() as never);
    await service.remove('u-2', admin);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u-2' }, data: { deletedAt: expect.any(Date), isActive: false } });
  });

  it('resets the password, clears the lock and signs the user out', async () => {
    prisma.user.findFirst.mockResolvedValue(row() as never);
    const creds = await service.resetPassword('u-2');
    expect(isStrongPassword(creds.password ?? '')).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-2' },
      data: { passwordHash: 'hash', failedLoginCount: 0, lockedUntil: null },
    });
    expect(tokens.revokeUserSessions).toHaveBeenCalledWith('u-2', 'password_reset');
  });

  it('resets showroom passwords only for branch accounts', async () => {
    prisma.user.findFirst.mockResolvedValue(row() as never);
    expect(await code(service.resetShowroomPassword('u-2'))).toBe('NO_SHOWROOM');
    prisma.user.findFirst.mockResolvedValue(row({ role: 'CASHIER', branch: { id: 'b', code: 'GH', name: 'x', nameAr: 'x' } }) as never);
    const creds = await service.resetShowroomPassword('u-2');
    expect(creds.showroomPassword).toBeDefined();
    expect(creds.password).toBeUndefined();
    expect(tokens.revokeUserSessions).toHaveBeenCalledWith('u-2', 'showroom_password_reset', { audience: 'SHOWROOM' });
  });

  it('resets 2FA and signs the user out', async () => {
    prisma.user.findFirst.mockResolvedValue(row({ twoFactorEnabled: true }) as never);
    await service.resetTwoFactor('u-2');
    expect(twoFactor.disable).toHaveBeenCalledWith('u-2');
    expect(tokens.revokeUserSessions).toHaveBeenCalledWith('u-2', '2fa_reset');
  });

  it('404s for missing or deleted users', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
