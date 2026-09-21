import { BadRequestException, Injectable } from '@nestjs/common';
import { checkPasswordRules } from '../../../shared/validation';
import { AuditTrail } from '../activity/audit-trail.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { TwoFactorService, type TwoFactorSetup } from '../auth/two-factor.service';
import type { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ChangePasswordDto,
  ChangeShowroomPasswordDto,
  SecondFactorConfirmDto,
} from './dto/account.dto';

const badRequest = (code: string, message: string, field?: string) =>
  new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    code,
    message,
    ...(field ? { errors: [{ field, messages: [message] }] } : {}),
  });

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly twoFactor: TwoFactorService,
    private readonly trail: AuditTrail,
  ) {}

  /** Changes the dashboard password and signs the user out everywhere. */
  async changePassword(user: AuthUser, dto: ChangePasswordDto): Promise<void> {
    const account = await this.account(user.id);
    await this.confirmPassword(account.passwordHash, dto.currentPassword, 'currentPassword');
    this.assertNotUsername(dto.newPassword, account.username);
    if (dto.newPassword === dto.currentPassword) {
      throw badRequest('PASSWORD_UNCHANGED', 'The new password must be different from the current one.', 'newPassword');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(dto.newPassword), failedLoginCount: 0, lockedUntil: null },
    });
    const revoked = await this.tokens.revokeUserSessions(user.id, 'password_change');
    this.trail.setEntity('User', user.id).addMetadata({ sessionsRevoked: revoked });
  }

  /** Changes the separate showroom password (typed on the kiosk tablet). */
  async changeShowroomPassword(user: AuthUser, dto: ChangeShowroomPasswordDto): Promise<void> {
    const account = await this.account(user.id);
    if (!account.branchId) {
      throw badRequest('NO_SHOWROOM', 'Only branch accounts have showroom credentials.');
    }
    await this.confirmPassword(account.passwordHash, dto.currentPassword, 'currentPassword');
    this.assertNotUsername(dto.newPassword, account.username);
    if (await this.passwords.verify(account.passwordHash, dto.newPassword)) {
      throw badRequest(
        'SHOWROOM_SAME_AS_DASHBOARD',
        'Use a different password from your dashboard password — it is typed on a shared tablet.',
        'newPassword',
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        showroomPasswordHash: await this.passwords.hash(dto.newPassword),
        showroomFailedCount: 0,
        showroomLockedUntil: null,
      },
    });
    const revoked = await this.tokens.revokeUserSessions(user.id, 'showroom_password_change', { audience: 'SHOWROOM' });
    this.trail.setEntity('User', user.id).addMetadata({ showroomSessionsRevoked: revoked });
  }

  async twoFactorStatus(user: AuthUser): Promise<{ enabled: boolean; recoveryCodesRemaining: number }> {
    const account = await this.account(user.id);
    return {
      enabled: account.twoFactorEnabled,
      recoveryCodesRemaining: account.twoFactorEnabled ? await this.twoFactor.remainingRecoveryCodes(user.id) : 0,
    };
  }

  async beginTwoFactorSetup(user: AuthUser, password: string): Promise<TwoFactorSetup> {
    const account = await this.account(user.id);
    await this.confirmPassword(account.passwordHash, password, 'password');
    this.trail.setEntity('User', user.id);
    return this.twoFactor.beginSetup(account);
  }

  async enableTwoFactor(user: AuthUser, code: string): Promise<{ recoveryCodes: string[] }> {
    this.trail.setEntity('User', user.id).setChange({ twoFactorEnabled: false }, { twoFactorEnabled: true });
    return { recoveryCodes: await this.twoFactor.enable(user.id, code) };
  }

  async disableTwoFactor(user: AuthUser, dto: SecondFactorConfirmDto): Promise<void> {
    await this.confirmSecondFactor(user, dto);
    await this.twoFactor.disable(user.id);
    this.trail.setEntity('User', user.id).setChange({ twoFactorEnabled: true }, { twoFactorEnabled: false });
  }

  async regenerateRecoveryCodes(user: AuthUser, dto: SecondFactorConfirmDto): Promise<{ recoveryCodes: string[] }> {
    await this.confirmSecondFactor(user, dto);
    this.trail.setEntity('User', user.id);
    return { recoveryCodes: await this.twoFactor.regenerateRecoveryCodes(user.id) };
  }

  private async confirmSecondFactor(user: AuthUser, dto: SecondFactorConfirmDto): Promise<void> {
    const account = await this.account(user.id);
    if (!account.twoFactorEnabled) throw badRequest('2FA_DISABLED', 'Two-factor authentication is not enabled.');
    await this.confirmPassword(account.passwordHash, dto.password, 'password');
    const ok = dto.recoveryCode
      ? await this.twoFactor.useRecoveryCode(user.id, dto.recoveryCode)
      : await this.twoFactor.verifyCode(user.id, dto.code ?? '');
    if (!ok) throw badRequest('INVALID_2FA', 'The verification code is not valid.', dto.recoveryCode ? 'recoveryCode' : 'code');
  }

  private account(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { id: true, username: true, passwordHash: true, branchId: true, twoFactorEnabled: true },
    });
  }

  private async confirmPassword(hash: string, password: string, field: string): Promise<void> {
    if (!(await this.passwords.verify(hash, password))) {
      throw badRequest('WRONG_PASSWORD', 'The password is not correct.', field);
    }
  }

  private assertNotUsername(password: string, username: string): void {
    const rule = checkPasswordRules(password, username).find((r) => r.rule === 'notUsername');
    if (rule && !rule.ok) {
      throw badRequest('PASSWORD_CONTAINS_USERNAME', 'The password must not contain your username.', 'newPassword');
    }
  }
}
