import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Env } from '../config/env';
import { Audit, SkipAudit } from '../common/decorators/audit.decorator';
import { AuthThrottle } from '../common/decorators/auth-throttle.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ShowroomSession } from '../common/decorators/showroom-session.decorator';
import { AuthFailedException } from '../common/errors';
import { type AuthUser, requestMeta } from '../common/types';
import type { SessionAudience } from '../generated/prisma/client';
import { AuthService, publicAuth } from './auth.service';
import type { AuthResult, IssuedAuth, Profile, TwoFactorChallenge } from './auth.types';
import { clearRefreshCookie, hasCsrfHeader, readRefreshCookie, setRefreshCookie } from './cookies';
import { LoginDto, TwoFactorLoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get secure(): boolean {
    return this.config.get('COOKIE_SECURE', { infer: true });
  }

  private withCookie(res: Response, audience: SessionAudience, result: IssuedAuth): AuthResult {
    setRefreshCookie(res, audience, result.refreshToken, result.refreshExpiresAt, this.secure);
    return publicAuth(result);
  }

  private requireCsrf(req: Request): void {
    if (!hasCsrfHeader(req)) {
      throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'CSRF', message: 'Missing request header.' });
    }
  }

  /** Dashboard sign-in. The role (and so the landing dashboard) comes from the account itself. */
  @Public()
  @AuthThrottle()
  @Audit('auth.login', { entity: 'Session' })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult | TwoFactorChallenge> {
    const result = await this.auth.login(dto, requestMeta(req));
    return 'twoFactorRequired' in result ? result : this.withCookie(res, 'DASHBOARD', result);
  }

  @Public()
  @AuthThrottle()
  @Audit('auth.login.2fa', { entity: 'Session' })
  @Post('login/2fa')
  @HttpCode(200)
  async loginTwoFactor(
    @Body() dto: TwoFactorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult> {
    return this.withCookie(res, 'DASHBOARD', await this.auth.loginTwoFactor(dto, requestMeta(req)));
  }

  /** Rotates the refresh cookie and returns a new access token plus the current profile. */
  @Public()
  @ApiCookieAuth('wc_rt')
  @SkipAudit('high-volume token rotation; refresh-token reuse is audited by TokenService')
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResult> {
    return this.rotate(req, res, 'DASHBOARD');
  }

  @Public()
  @ApiCookieAuth('wc_rt')
  @Audit('auth.logout', { entity: 'Session' })
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.requireCsrf(req);
    await this.auth.logout(readRefreshCookie(req, 'DASHBOARD'));
    clearRefreshCookie(res, 'DASHBOARD', this.secure);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current user with effective permissions' })
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<Profile> {
    return this.auth.profile(user);
  }

  // ---- showroom kiosk ------------------------------------------------------

  @Public()
  @AuthThrottle()
  @Audit('auth.showroom.login', { entity: 'Session' })
  @Post('showroom/login')
  @HttpCode(200)
  async showroomLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult> {
    return this.withCookie(res, 'SHOWROOM', await this.auth.showroomLogin(dto, requestMeta(req)));
  }

  @Public()
  @ApiCookieAuth('wc_srt')
  @SkipAudit('high-volume token rotation; refresh-token reuse is audited by TokenService')
  @Post('showroom/refresh')
  @HttpCode(200)
  async showroomRefresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResult> {
    return this.rotate(req, res, 'SHOWROOM');
  }

  @Public()
  @ApiCookieAuth('wc_srt')
  @Audit('auth.showroom.logout', { entity: 'Session' })
  @Post('showroom/logout')
  @HttpCode(204)
  async showroomLogout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.requireCsrf(req);
    await this.auth.logout(readRefreshCookie(req, 'SHOWROOM'));
    clearRefreshCookie(res, 'SHOWROOM', this.secure);
  }

  @ApiBearerAuth()
  @ShowroomSession()
  @Get('showroom/me')
  showroomMe(@CurrentUser() user: AuthUser): Promise<Profile> {
    return this.auth.profile(user);
  }

  private async rotate(req: Request, res: Response, audience: SessionAudience): Promise<AuthResult> {
    this.requireCsrf(req);
    const raw = readRefreshCookie(req, audience);
    if (!raw) throw new AuthFailedException('SESSION_EXPIRED');
    try {
      return this.withCookie(res, audience, await this.auth.refresh(raw, audience, requestMeta(req)));
    } catch (err) {
      clearRefreshCookie(res, audience, this.secure);
      throw err;
    }
  }
}
