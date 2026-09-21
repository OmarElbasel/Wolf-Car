import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mock } from 'jest-mock-extended';
import { authUser, httpContext } from '../../test/unit/helpers';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { SHOWROOM_SESSION_KEY } from '../common/decorators/showroom-session.decorator';
import { AuthFailedException } from '../common/errors';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { SessionUserService } from './session-user.service';
import type { AccessPayload, TokenService } from './token.service';

const marked = (key: string) => {
  const fn = () => undefined;
  Reflect.defineMetadata(key, true, fn);
  return fn;
};

const payload = (aud: 'dashboard' | 'showroom'): AccessPayload => ({ sub: 'u-1', sid: 's-1', aud, role: 'CASHIER', bid: 'b-1' });

describe('JwtAuthGuard', () => {
  const tokens = mock<TokenService>();
  const sessions = mock<SessionUserService>();
  const guard = new JwtAuthGuard(new Reflector(), tokens, sessions);
  beforeEach(() => jest.resetAllMocks());

  it('lets @Public routes through without a token', async () => {
    await expect(guard.canActivate(httpContext({}, marked(IS_PUBLIC_KEY)))).resolves.toBe(true);
    expect(tokens.verifyAccess).not.toHaveBeenCalled();
  });

  it('rejects a missing or malformed bearer token with 401', async () => {
    await expect(guard.canActivate(httpContext({}))).rejects.toBeInstanceOf(AuthFailedException);
    tokens.verifyAccess.mockRejectedValue(new Error('bad signature'));
    await expect(guard.canActivate(httpContext({ headers: { authorization: 'Bearer x' } }))).rejects.toBeInstanceOf(
      AuthFailedException,
    );
  });

  it('rejects showroom tokens on dashboard routes and vice versa (403)', async () => {
    tokens.verifyAccess.mockResolvedValue(payload('showroom'));
    await expect(guard.canActivate(httpContext({ headers: { authorization: 'Bearer t' } }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    tokens.verifyAccess.mockResolvedValue(payload('dashboard'));
    await expect(
      guard.canActivate(httpContext({ headers: { authorization: 'Bearer t' } }, marked(SHOWROOM_SESSION_KEY))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects revoked sessions and attaches the principal otherwise', async () => {
    tokens.verifyAccess.mockResolvedValue(payload('dashboard'));
    sessions.load.mockResolvedValueOnce(null);
    await expect(guard.canActivate(httpContext({ headers: { authorization: 'Bearer t' } }))).rejects.toBeInstanceOf(
      AuthFailedException,
    );

    const user = authUser();
    sessions.load.mockResolvedValueOnce(user);
    const ctx = httpContext({ headers: { authorization: 'Bearer t' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toBe(user);
    expect(sessions.load).toHaveBeenLastCalledWith('s-1', 'u-1', 'DASHBOARD');
  });
});
