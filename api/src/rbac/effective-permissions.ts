import { isPermissionKey, PERMISSION_KEYS, type PermissionKey } from '../../../shared/permissions';
import type { PermissionEffect, Role } from '../generated/prisma/client';

export interface OverrideRow {
  permissionKey: string;
  effect: PermissionEffect;
}

/**
 * Effective permissions = role grants + user GRANT overrides − user REVOKE
 * overrides. SUPER_ADMIN always has everything (cannot be locked out).
 */
export function computeEffectivePermissions(
  role: Role,
  rolePermissionKeys: readonly string[],
  overrides: readonly OverrideRow[],
): Set<PermissionKey> {
  if (role === 'SUPER_ADMIN') return new Set(PERMISSION_KEYS);
  const result = new Set<PermissionKey>(rolePermissionKeys.filter(isPermissionKey));
  for (const o of overrides) {
    if (!isPermissionKey(o.permissionKey)) continue;
    if (o.effect === 'GRANT') result.add(o.permissionKey);
    else result.delete(o.permissionKey);
  }
  return result;
}
