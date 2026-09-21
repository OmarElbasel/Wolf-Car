import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../../../../shared/permissions';

export const PERMISSIONS_KEY = 'rbac:permissions';

export interface PermissionRequirement {
  /** every one of these is required */
  all: PermissionKey[];
  /** at least one of these is required (ignored when empty) */
  any: PermissionKey[];
}

/** Requires ALL of the given permissions. */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, { all: permissions, any: [] } satisfies PermissionRequirement);

/** Requires AT LEAST ONE of the given permissions. */
export const RequireAnyPermission = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, { all: [], any: permissions } satisfies PermissionRequirement);
