import type { CookieOptions, Request, Response } from 'express';
import type { SessionAudience } from '../generated/prisma/client';

export const REFRESH_COOKIES: Record<SessionAudience, { name: string; path: string }> = {
  DASHBOARD: { name: 'wc_rt', path: '/api/auth' },
  SHOWROOM: { name: 'wc_srt', path: '/api/auth/showroom' },
};

/**
 * Cookie-authenticated endpoints (refresh, logout) also require this header.
 * A cross-site form or <img> cannot set it, and a cross-origin fetch that sets
 * it triggers a CORS preflight that the allowlist rejects.
 */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'wolfcar';

function options(audience: SessionAudience, secure: boolean, expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: REFRESH_COOKIES[audience].path,
    ...(expires ? { expires } : {}),
  };
}

export function setRefreshCookie(res: Response, audience: SessionAudience, token: string, expires: Date, secure: boolean): void {
  res.cookie(REFRESH_COOKIES[audience].name, token, options(audience, secure, expires));
}

export function clearRefreshCookie(res: Response, audience: SessionAudience, secure: boolean): void {
  res.clearCookie(REFRESH_COOKIES[audience].name, options(audience, secure));
}

export function readRefreshCookie(req: Request, audience: SessionAudience): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, unknown> }).cookies;
  const value = cookies?.[REFRESH_COOKIES[audience].name];
  return typeof value === 'string' && value.length > 0 && value.length < 200 ? value : undefined;
}

export function hasCsrfHeader(req: Request): boolean {
  return req.headers[CSRF_HEADER] === CSRF_VALUE;
}
