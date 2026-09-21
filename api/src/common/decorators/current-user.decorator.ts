import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AppRequest, AuthUser } from '../types';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.user) throw new UnauthorizedException();
  return req.user;
});
