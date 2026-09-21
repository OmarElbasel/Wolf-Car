import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActivityService } from '../activity/activity.service';
import { PERMISSIONS_KEY, PermissionRequirement } from '../common/decorators/require-permissions.decorator';
import { AppRequest, requestMeta } from '../common/types';

/**
 * Runs after JwtAuthGuard. Checks the @RequirePermissions / @RequireAnyPermission
 * metadata against the user's effective permissions (resolved from the database
 * on every request, so revocations apply immediately). Denials are audited
 * here because guards run before interceptors.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly activity: ActivityService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!requirement || !req.user) return true;

    const granted = req.user.permissions;
    const allOk = requirement.all.every((p) => granted.has(p));
    const anyOk = requirement.any.length === 0 || requirement.any.some((p) => granted.has(p));
    if (allOk && anyOk) return true;

    const { ip, userAgent } = requestMeta(req);
    await this.activity.record({
      action: 'access.denied',
      outcome: 'FAILURE',
      actorId: req.user.id,
      actorUsername: req.user.username,
      actorRole: req.user.role,
      branchId: req.user.branchId,
      metadata: {
        method: req.method,
        path: req.route?.path ?? req.path,
        required: requirement.all.length ? requirement.all : requirement.any,
        mode: requirement.all.length ? 'all' : 'any',
      },
      ip,
      userAgent,
      requestId: req.id,
    });
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: 'MISSING_PERMISSION',
      message: 'You do not have permission to do this.',
    });
  }
}
