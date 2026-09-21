import type { ExecutionContext } from '@nestjs/common';
import type { PermissionKey } from '../../../shared/permissions';
import type { AppRequest, AuthUser } from '../../src/common/types';

export function authUser(overrides: Partial<AuthUser> = {}, permissions: PermissionKey[] = []): AuthUser {
  return {
    id: 'u-1',
    username: 'gh.cashier',
    displayName: 'Cashier',
    role: 'CASHIER',
    branchId: 'b-1',
    sessionId: 's-1',
    audience: 'DASHBOARD',
    permissions: new Set(permissions),
    ...overrides,
  };
}

export function httpContext(
  req: Partial<AppRequest>,
  handler: () => void = () => undefined,
  cls: new () => unknown = class {},
): ExecutionContext {
  const request = { headers: {}, params: {}, method: 'GET', path: '/x', id: 'req-1', ...req } as AppRequest;
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}
