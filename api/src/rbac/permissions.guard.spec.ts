import { ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mock } from 'jest-mock-extended';
import { authUser, httpContext } from '../../test/unit/helpers';
import type { ActivityService } from '../activity/activity.service';
import { PERMISSIONS_KEY } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

function handlerWith(requirement: unknown): () => void {
  const fn = () => undefined;
  SetMetadata(PERMISSIONS_KEY, requirement)(fn as never, undefined as never, undefined as never);
  // SetMetadata on a plain function stores metadata on the function itself
  Reflect.defineMetadata(PERMISSIONS_KEY, requirement, fn);
  return fn;
}

describe('PermissionsGuard', () => {
  const activity = mock<ActivityService>();
  const guard = new PermissionsGuard(new Reflector(), activity);
  beforeEach(() => jest.resetAllMocks());

  it('allows routes without a requirement', async () => {
    await expect(guard.canActivate(httpContext({ user: authUser() }))).resolves.toBe(true);
  });

  it('requires every permission in "all" mode', async () => {
    const handler = handlerWith({ all: ['order.confirm', 'order.read.branch'], any: [] });
    await expect(
      guard.canActivate(httpContext({ user: authUser({}, ['order.confirm', 'order.read.branch']) }, handler)),
    ).resolves.toBe(true);
    await expect(guard.canActivate(httpContext({ user: authUser({}, ['order.confirm']) }, handler))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('requires one permission in "any" mode', async () => {
    const handler = handlerWith({ all: [], any: ['order.read.branch', 'order.read.all'] });
    await expect(guard.canActivate(httpContext({ user: authUser({}, ['order.read.all']) }, handler))).resolves.toBe(true);
    await expect(guard.canActivate(httpContext({ user: authUser({}, []) }, handler))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('audits every denial with the missing requirement', async () => {
    const handler = handlerWith({ all: ['product.update.price'], any: [] });
    await expect(
      guard.canActivate(httpContext({ user: authUser({ role: 'BRANCH_MANAGER' }), method: 'PATCH' }, handler)),
    ).rejects.toThrow();
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'access.denied',
        outcome: 'FAILURE',
        actorRole: 'BRANCH_MANAGER',
        metadata: expect.objectContaining({ required: ['product.update.price'], method: 'PATCH' }),
      }),
    );
  });
});
