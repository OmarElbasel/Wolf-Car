import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { hasCsrfHeader, readSlotsCookie } from '../auth/cookies';
import { SalesAccessService } from './sales-access.service';

/**
 * For the @Public() sales routes: the request must carry a valid slots cookie.
 * State-changing requests are cookie-authenticated, so they also need the CSRF
 * header, like logout and refresh. Checked here so it runs before validation.
 */
@Injectable()
export class SalesAccessGuard implements CanActivate {
  constructor(private readonly access: SalesAccessService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    await this.access.verify(readSlotsCookie(req));
    if (req.method !== 'GET' && !hasCsrfHeader(req)) {
      throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'CSRF', message: 'Missing request header.' });
    }
    return true;
  }
}
