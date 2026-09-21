import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { SHOWROOM_SESSION_KEY } from '../common/decorators/showroom-session.decorator';
import { AuthFailedException } from '../common/errors';
import type { AppRequest } from '../common/types';
import { SessionUserService } from './session-user.service';
import { TokenService } from './token.service';

/**
 * Global guard. Every route requires a valid access token unless marked
 * @Public(). Showroom routes (@ShowroomSession) accept only showroom tokens,
 * and every other route accepts only dashboard tokens.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionUserService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const header = req.headers.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (!token) throw new AuthFailedException('SESSION_EXPIRED');

    let payload;
    try {
      payload = await this.tokens.verifyAccess(token);
    } catch {
      throw new AuthFailedException('SESSION_EXPIRED');
    }

    const showroomRoute = this.reflector.getAllAndOverride<boolean>(SHOWROOM_SESSION_KEY, targets) === true;
    const expected = showroomRoute ? 'showroom' : 'dashboard';
    if (payload.aud !== expected) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'WRONG_SESSION_TYPE',
        message: showroomRoute ? 'Sign in to the showroom to continue.' : 'Showroom sessions cannot access the dashboard.',
      });
    }

    const user = await this.sessions.load(payload.sid, payload.sub, showroomRoute ? 'SHOWROOM' : 'DASHBOARD');
    if (!user) throw new AuthFailedException('SESSION_EXPIRED');
    req.user = user;
    return true;
  }
}
