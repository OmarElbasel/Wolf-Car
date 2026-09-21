import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { TwoFactorSetup } from '../auth/two-factor.service';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthThrottle } from '../common/decorators/auth-throttle.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/types';
import { AccountService } from './account.service';
import {
  ChangePasswordDto,
  ChangeShowroomPasswordDto,
  PasswordConfirmDto,
  SecondFactorConfirmDto,
  TotpCodeDto,
} from './dto/account.dto';

/** Self-service settings for the signed-in user. */
@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** Signs the user out of every session afterwards (they sign in again with the new password). */
  @AuthThrottle()
  @Audit('account.password.change', { entity: 'User' })
  @Patch('password')
  @HttpCode(204)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.account.changePassword(user, dto);
  }

  @AuthThrottle()
  @RequirePermissions('showroom.password.view_or_change')
  @Audit('account.showroom_password.change', { entity: 'User' })
  @Patch('showroom-password')
  @HttpCode(204)
  changeShowroomPassword(@CurrentUser() user: AuthUser, @Body() dto: ChangeShowroomPasswordDto): Promise<void> {
    return this.account.changeShowroomPassword(user, dto);
  }

  @Get('2fa')
  twoFactorStatus(@CurrentUser() user: AuthUser) {
    return this.account.twoFactorStatus(user);
  }

  /** Returns a QR code (and the secret for manual entry). 2FA is not active until /2fa/enable succeeds. */
  @AuthThrottle()
  @Audit('account.2fa.setup', { entity: 'User' })
  @Post('2fa/setup')
  @HttpCode(200)
  setup(@CurrentUser() user: AuthUser, @Body() dto: PasswordConfirmDto): Promise<TwoFactorSetup> {
    return this.account.beginTwoFactorSetup(user, dto.password);
  }

  /** Returns 10 one-time recovery codes. They are shown once and stored only as hashes. */
  @AuthThrottle()
  @Audit('account.2fa.enable', { entity: 'User' })
  @Post('2fa/enable')
  @HttpCode(200)
  enable(@CurrentUser() user: AuthUser, @Body() dto: TotpCodeDto): Promise<{ recoveryCodes: string[] }> {
    return this.account.enableTwoFactor(user, dto.code);
  }

  @AuthThrottle()
  @Audit('account.2fa.disable', { entity: 'User' })
  @Post('2fa/disable')
  @HttpCode(204)
  disable(@CurrentUser() user: AuthUser, @Body() dto: SecondFactorConfirmDto): Promise<void> {
    return this.account.disableTwoFactor(user, dto);
  }

  @AuthThrottle()
  @Audit('account.2fa.recovery_codes.regenerate', { entity: 'User' })
  @Post('2fa/recovery-codes')
  @HttpCode(200)
  regenerate(@CurrentUser() user: AuthUser, @Body() dto: SecondFactorConfirmDto): Promise<{ recoveryCodes: string[] }> {
    return this.account.regenerateRecoveryCodes(user, dto);
  }
}
