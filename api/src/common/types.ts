import type { Request } from 'express';
import type { PermissionKey } from '../../../shared/permissions';
import type { Role, SessionAudience } from '../generated/prisma/client';

/** The authenticated principal attached to every non-public request. */
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  branchId: string | null;
  sessionId: string;
  audience: SessionAudience;
  permissions: ReadonlySet<PermissionKey>;
}

export interface AppRequest extends Request {
  id: string;
  user?: AuthUser;
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export function requestMeta(req: Request): RequestMeta {
  const ua = req.headers['user-agent'];
  return {
    ip: req.ip ?? null,
    userAgent: typeof ua === 'string' ? ua.slice(0, 512) : null,
  };
}
