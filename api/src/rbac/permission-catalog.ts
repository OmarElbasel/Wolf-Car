import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
  PERMISSIONS,
  type PermissionKey,
} from '../../../shared/permissions';
import type { PrismaClient, Role } from '../generated/prisma/client';

/**
 * Makes the permissions table match shared/permissions.ts. Keys that are new
 * to the database also receive their default role grants; existing grants are
 * never touched, so changes made by the Super Admin survive restarts.
 * Returns the keys that were newly created.
 */
export async function syncPermissionCatalog(db: PrismaClient): Promise<PermissionKey[]> {
  const existing = new Set((await db.permission.findMany({ select: { key: true } })).map((p) => p.key));
  const created = PERMISSION_KEYS.filter((k) => !existing.has(k));

  await db.$transaction(async (tx) => {
    for (const key of PERMISSION_KEYS) {
      const { group, description } = PERMISSIONS[key];
      await tx.permission.upsert({
        where: { key },
        create: { key, group, description },
        update: { group, description },
      });
    }
    const grants = (Object.entries(DEFAULT_ROLE_PERMISSIONS) as [Role, PermissionKey[]][]).flatMap(([role, keys]) =>
      keys.filter((k) => created.includes(k)).map((permissionKey) => ({ role, permissionKey })),
    );
    if (grants.length) await tx.rolePermission.createMany({ data: grants, skipDuplicates: true });
  });
  return created;
}
