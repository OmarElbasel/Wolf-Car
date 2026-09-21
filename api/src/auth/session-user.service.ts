import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../common/types';
import type { PermissionKey } from '../../../shared/permissions';
import type { Role, SessionAudience } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeEffectivePermissions } from '../rbac/effective-permissions';

/**
 * Resolves an access token's session into the request principal. Runs on every
 * authenticated request so that logout, revocation, deactivation and
 * permission changes take effect immediately rather than at token expiry.
 */
@Injectable()
export class SessionUserService {
  constructor(private readonly prisma: PrismaService) {}

  async load(sessionId: string, userId: string, audience: SessionAudience): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        audience: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
            branchId: true,
            isActive: true,
            deletedAt: true,
            permissionOverrides: { select: { permissionKey: true, effect: true } },
          },
        },
      },
    });
    if (
      !session ||
      session.userId !== userId ||
      session.audience !== audience ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      return null;
    }
    const u = session.user;
    if (!u.isActive || u.deletedAt) return null;

    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      branchId: u.branchId,
      sessionId,
      audience,
      permissions: computeEffectivePermissions(u.role, await this.rolePermissions(u.role), u.permissionOverrides),
    };
  }

  /** Effective permissions for a user without a session (e.g. before starting one). */
  async permissionsFor(user: { id: string; role: Role }): Promise<Set<PermissionKey>> {
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: { userId: user.id },
      select: { permissionKey: true, effect: true },
    });
    return computeEffectivePermissions(user.role, await this.rolePermissions(user.role), overrides);
  }

  private async rolePermissions(role: Role): Promise<string[]> {
    if (role === 'SUPER_ADMIN') return [];
    const rows = await this.prisma.rolePermission.findMany({ where: { role }, select: { permissionKey: true } });
    return rows.map((r) => r.permissionKey);
  }
}
