import { BadRequestException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PasswordService } from '../auth/password.service';
import type { TokenService } from '../auth/token.service';
import type { TwoFactorService } from '../auth/two-factor.service';
import type { PrismaService } from '../prisma/prisma.service';
import { AccountService } from './account.service';

const account = { id: 'u-1', username: 'gh.cashier', passwordHash: 'hash', branchId: 'b-1', twoFactorEnabled: false };

describe('AccountService', () => {
  const prisma = mockDeep<PrismaService>();
  const passwords = mock<PasswordService>();
  const tokens = mock<TokenService>();
  const twoFactor = mock<TwoFactorService>();
  const trail = mock<AuditTrail>();
  const service = new AccountService(prisma, passwords, tokens, twoFactor, trail);
  const user = authUser({ username: 'gh.cashier' });

  beforeEach(() => {
    jest.resetAllMocks();
    trail.setEntity.mockReturnValue(trail);
    trail.addMetadata.mockReturnValue(trail);
    trail.setChange.mockReturnValue(trail);
    prisma.user.findUniqueOrThrow.mockResolvedValue(account as never);
    passwords.hash.mockResolvedValue('new-hash');
  });

  const code = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      return ((e as BadRequestException).getResponse() as { code: string }).code;
    }
    throw new Error('expected a rejection');
  };

  describe('changePassword', () => {
    it('requires the current password', async () => {
      passwords.verify.mockResolvedValue(false);
      expect(await code(service.changePassword(user, { currentPassword: 'x', newPassword: 'Str0ng#Password!' }))).toBe('WRONG_PASSWORD');
    });

    it('rejects passwords containing the username', async () => {
      passwords.verify.mockResolvedValue(true);
      expect(await code(service.changePassword(user, { currentPassword: 'x', newPassword: 'Gh.Cashier#2026!' }))).toBe(
        'PASSWORD_CONTAINS_USERNAME',
      );
    });

    it('rejects re-using the same password', async () => {
      passwords.verify.mockResolvedValue(true);
      expect(await code(service.changePassword(user, { currentPassword: 'Str0ng#Password!', newPassword: 'Str0ng#Password!' }))).toBe(
        'PASSWORD_UNCHANGED',
      );
    });

    it('stores the new hash and revokes every session', async () => {
      passwords.verify.mockResolvedValue(true);
      tokens.revokeUserSessions.mockResolvedValue(3);
      await service.changePassword(user, { currentPassword: 'Old#Password123', newPassword: 'Str0ng#Password!' });
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ passwordHash: 'new-hash' }) }));
      expect(tokens.revokeUserSessions).toHaveBeenCalledWith('u-1', 'password_change');
    });
  });

  describe('changeShowroomPassword', () => {
    it('is only for branch accounts', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...account, branchId: null } as never);
      expect(await code(service.changeShowroomPassword(user, { currentPassword: 'x', newPassword: 'Str0ng#Password!' }))).toBe('NO_SHOWROOM');
    });

    it('must differ from the dashboard password', async () => {
      passwords.verify.mockResolvedValue(true); // current ok, and new == dashboard password
      expect(await code(service.changeShowroomPassword(user, { currentPassword: 'x', newPassword: 'Str0ng#Password!' }))).toBe(
        'SHOWROOM_SAME_AS_DASHBOARD',
      );
    });

    it('updates the showroom hash and signs out showroom sessions only', async () => {
      passwords.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      await service.changeShowroomPassword(user, { currentPassword: 'x', newPassword: 'Kiosk#Password9' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ showroomPasswordHash: 'new-hash' }) }),
      );
      expect(tokens.revokeUserSessions).toHaveBeenCalledWith('u-1', 'showroom_password_change', { audience: 'SHOWROOM' });
    });
  });

  describe('two-factor', () => {
    it('requires the password to start setup', async () => {
      passwords.verify.mockResolvedValue(false);
      expect(await code(service.beginTwoFactorSetup(user, 'x'))).toBe('WRONG_PASSWORD');
      expect(twoFactor.beginSetup).not.toHaveBeenCalled();
    });

    it('requires password and a valid second factor to disable', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...account, twoFactorEnabled: true } as never);
      passwords.verify.mockResolvedValue(true);
      twoFactor.verifyCode.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      expect(await code(service.disableTwoFactor(user, { password: 'x', code: '123456' }))).toBe('INVALID_2FA');
      await service.disableTwoFactor(user, { password: 'x', code: '123456' });
      expect(twoFactor.disable).toHaveBeenCalledWith('u-1');
    });
  });
});
