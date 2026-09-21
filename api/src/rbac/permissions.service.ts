import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PERMISSION_KEYS, PERMISSIONS, ROLES, type PermissionKey, type RoleName } from '../../../shared/permissions';
import { AuditTrail } from '../activity/audit-trail.service';
import type { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeEffectivePermissions } from './effective-permissions';
import { syncPermissionCatalog } from './permission-catalog';
import type { SetUserOverridesDto } from './dto/permissions.dto';

const LOCKED_ROLE: Role = 'SUPER_ADMIN';

const lockedError = () =>
  new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    code: 'ROLE_LOCKED',
    message: 'Super Admin always has every permission and cannot be changed.',
  });

@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trail: AuditTrail,
  ) {}

  /** Keeps the permissions table in step with shared/permissions.ts on every boot. */
  async onModuleInit(): Promise<void> {
    await syncPermissionCatalog(this.prisma);
  }

  catalog() {
    return PERMISSION_KEYS.map((key) => ({ key, ...PERMISSIONS[key] }));
  }

  async roleMatrix(): Promise<{ roles: Record<RoleName, PermissionKey[]>; locked: RoleName[] }> {
    const rows = await this.prisma.rolePermission.findMany({ select: { role: true, permissionKey: true } });
    const roles = Object.fromEntries(ROLES.map((r) => [r, [] as PermissionKey[]])) as Record<RoleName, PermissionKey[]>;
    roles.SUPER_ADMIN = [...PERMISSION_KEYS];
    for (const row of rows) {
      if (row.role !== LOCKED_ROLE && (PERMISSION_KEYS as string[]).includes(row.permissionKey)) {
        roles[row.role].push(row.permissionKey as PermissionKey);
      }
    }
    for (const r of ROLES) roles[r].sort();
    return { roles, locked: [LOCKED_ROLE] };
  }

  async setRolePermissions(role: Role, permissions: PermissionKey[]): Promise<PermissionKey[]> {
    if (role === LOCKED_ROLE) throw lockedError();
    const before = (await this.roleMatrix()).roles[role];
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { role } }),
      this.prisma.rolePermission.createMany({ data: permissions.map((permissionKey) => ({ role, permissionKey })) }),
    ]);
    const after = [...permissions].sort();
    this.trail.setEntity('Role', role).setChange({ permissions: before }, { permissions: after });
    return after;
  }

  async userPermissions(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        role: true,
        permissionOverrides: { select: { permissionKey: true, effect: true }, orderBy: { permissionKey: 'asc' } },
      },
    });
    if (!user) throw new NotFoundException('User not found.');
    const rolePermissions =
      user.role === LOCKED_ROLE
        ? [...PERMISSION_KEYS]
        : (await this.prisma.rolePermission.findMany({ where: { role: user.role }, select: { permissionKey: true } })).map(
            (r) => r.permissionKey as PermissionKey,
          );
    return {
      userId: user.id,
      role: user.role,
      locked: user.role === LOCKED_ROLE,
      rolePermissions: rolePermissions.sort(),
      overrides: user.permissionOverrides.map((o) => ({ permission: o.permissionKey as PermissionKey, effect: o.effect })),
      effective: [...computeEffectivePermissions(user.role, rolePermissions, user.permissionOverrides)].sort(),
    };
  }

  async setUserOverrides(userId: string, dto: SetUserOverridesDto, grantedById: string) {
    const current = await this.userPermissions(userId);
    if (current.locked) throw lockedError();
    await this.prisma.$transaction([
      this.prisma.userPermissionOverride.deleteMany({ where: { userId } }),
      this.prisma.userPermissionOverride.createMany({
        data: dto.overrides.map((o) => ({ userId, permissionKey: o.permission, effect: o.effect, grantedById })),
      }),
    ]);
    const updated = await this.userPermissions(userId);
    this.trail
      .setEntity('User', userId)
      .setChange({ overrides: current.overrides, effective: current.effective }, { overrides: updated.overrides, effective: updated.effective });
    return updated;
  }
}
