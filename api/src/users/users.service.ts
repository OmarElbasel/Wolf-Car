import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditTrail } from '../activity/audit-trail.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { TwoFactorService } from '../auth/two-factor.service';
import { generatePassword } from '../common/crypto';
import { type Page, skipTake } from '../common/pagination';
import type { AuthUser } from '../common/types';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './dto/users.dto';
import { generateUsername } from './username';
import { type IssuedCredentials, USER_VIEW_SELECT, userView, type UserView } from './users.types';

const BRANCH_ROLES = new Set(['BRANCH_MANAGER', 'CASHIER']);

const rule = (code: string, message: string) =>
  new BadRequestException({ statusCode: 400, error: 'Bad Request', code, message });

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly twoFactor: TwoFactorService,
    private readonly trail: AuditTrail,
  ) {}

  async list(q: ListUsersQueryDto): Promise<Page<UserView>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.role ? { role: q.role } : {}),
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(q.status === 'active' ? { isActive: true } : q.status === 'inactive' ? { isActive: false } : {}),
      ...(q.q
        ? {
            OR: [
              { username: { contains: q.q, mode: 'insensitive' } },
              { displayName: { contains: q.q, mode: 'insensitive' } },
              { email: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: USER_VIEW_SELECT, orderBy: [{ role: 'asc' }, { username: 'asc' }], ...skipTake(q) }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(userView), page: q.page, pageSize: q.pageSize, total };
  }

  async get(id: string): Promise<UserView> {
    return userView(await this.find(id));
  }

  async create(dto: CreateUserDto, actor: AuthUser): Promise<{ user: UserView; credentials: IssuedCredentials }> {
    const password = generatePassword();
    const passwordHash = await this.passwords.hash(password);
    const created = await this.prisma.$transaction(async (tx) =>
      tx.user.create({
        data: {
          username: await generateUsername(tx, dto.role),
          displayName: dto.displayName,
          email: dto.email ?? null,
          role: dto.role,
          passwordHash,
          createdById: actor.id,
        },
        select: USER_VIEW_SELECT,
      }),
    );
    const user = userView(created);
    this.trail.setEntity('User', user.id).setChange(null, user);
    return {
      user,
      credentials: { userId: user.id, username: user.username, displayName: user.displayName, role: user.role, branchCode: null, password },
    };
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser): Promise<UserView> {
    const current = await this.find(id);
    const before = userView(current);

    if (dto.role && dto.role !== current.role) {
      if (BRANCH_ROLES.has(current.role)) {
        throw rule('BRANCH_ROLE_FIXED', 'Branch staff keep their role. Replace them from the branch page instead.');
      }
      if (id === actor.id) throw rule('SELF_ROLE_CHANGE', 'You cannot change your own role.');
    }
    if (dto.isActive === false && id === actor.id) throw rule('SELF_DEACTIVATE', 'You cannot deactivate your own account.');
    const losesAdmin =
      current.role === 'SUPER_ADMIN' && ((dto.role && dto.role !== 'SUPER_ADMIN') || dto.isActive === false);
    if (losesAdmin) await this.assertAnotherActiveAdmin(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: USER_VIEW_SELECT,
    });
    if (dto.isActive === false || (dto.role && dto.role !== current.role)) {
      this.trail.addMetadata({ sessionsRevoked: await this.tokens.revokeUserSessions(id, 'account_changed') });
    }
    const after = userView(updated);
    this.trail.setEntity('User', id).setBranch(current.branch?.id ?? null).setChange(before, after);
    return after;
  }

  /** Soft-deletes a Super Admin or Finance account. Branch staff are replaced instead. */
  async remove(id: string, actor: AuthUser): Promise<void> {
    const current = await this.find(id);
    if (BRANCH_ROLES.has(current.role)) {
      throw rule('BRANCH_STAFF', 'Each branch needs a manager and a cashier. Replace them from the branch page instead.');
    }
    if (id === actor.id) throw rule('SELF_DELETE', 'You cannot delete your own account.');
    if (current.role === 'SUPER_ADMIN') await this.assertAnotherActiveAdmin(id);
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.tokens.revokeUserSessions(id, 'account_deleted');
    this.trail.setEntity('User', id).setChange(userView(current), null);
  }

  async resetPassword(id: string): Promise<IssuedCredentials> {
    const user = await this.find(id);
    const password = generatePassword();
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await this.passwords.hash(password), failedLoginCount: 0, lockedUntil: null },
    });
    const revoked = await this.tokens.revokeUserSessions(id, 'password_reset');
    this.trail.setEntity('User', id).setBranch(user.branch?.id ?? null).addMetadata({ sessionsRevoked: revoked });
    return this.credentials(user, { password });
  }

  async resetShowroomPassword(id: string): Promise<IssuedCredentials> {
    const user = await this.find(id);
    if (!user.branch) throw rule('NO_SHOWROOM', 'Only branch accounts have showroom credentials.');
    const showroomPassword = generatePassword();
    await this.prisma.user.update({
      where: { id },
      data: {
        showroomPasswordHash: await this.passwords.hash(showroomPassword),
        showroomFailedCount: 0,
        showroomLockedUntil: null,
      },
    });
    await this.tokens.revokeUserSessions(id, 'showroom_password_reset', { audience: 'SHOWROOM' });
    this.trail.setEntity('User', id).setBranch(user.branch.id);
    return this.credentials(user, { showroomPassword });
  }

  async resetTwoFactor(id: string): Promise<UserView> {
    const user = await this.find(id);
    await this.twoFactor.disable(id);
    await this.tokens.revokeUserSessions(id, '2fa_reset');
    this.trail
      .setEntity('User', id)
      .setBranch(user.branch?.id ?? null)
      .setChange({ twoFactorEnabled: user.twoFactorEnabled }, { twoFactorEnabled: false });
    return this.get(id);
  }

  async unlock(id: string): Promise<UserView> {
    const user = await this.find(id);
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null, showroomFailedCount: 0, showroomLockedUntil: null },
    });
    this.trail.setEntity('User', id).setBranch(user.branch?.id ?? null);
    return this.get(id);
  }

  private async find(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: USER_VIEW_SELECT });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private async assertAnotherActiveAdmin(excludingId: string): Promise<void> {
    const others = await this.prisma.user.count({
      where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null, id: { not: excludingId } },
    });
    if (others === 0) throw rule('LAST_ADMIN', 'At least one active Super Admin must remain.');
  }

  private credentials(
    user: { id: string; username: string; displayName: string; role: IssuedCredentials['role']; branch: { code: string } | null },
    secrets: Pick<IssuedCredentials, 'password' | 'showroomPassword'>,
  ): IssuedCredentials {
    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      branchCode: user.branch?.code ?? null,
      ...secrets,
    };
  }
}
