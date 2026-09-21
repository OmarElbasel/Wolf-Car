import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export type LoginChannel = 'dashboard' | 'showroom';

interface LockableUser {
  id: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
  showroomFailedCount: number;
  showroomLockedUntil: Date | null;
}

interface GhostEntry {
  count: number;
  lockedUntil: number;
}

const GHOST_LIMIT = 10_000;

/**
 * Account lockout after LOGIN_MAX_ATTEMPTS consecutive failures (password or
 * 2FA), for LOGIN_LOCK_MINUTES. The dashboard and showroom credentials are
 * counted separately. Unknown usernames are tracked in memory and locked the
 * same way, so lockout behaviour does not reveal which usernames exist.
 */
@Injectable()
export class LockoutService {
  private readonly ghosts = new Map<string, GhostEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get maxAttempts(): number {
    return this.config.get('LOGIN_MAX_ATTEMPTS', { infer: true });
  }

  private get lockMs(): number {
    return this.config.get('LOGIN_LOCK_MINUTES', { infer: true }) * 60_000;
  }

  /** Seconds until the lock expires, or 0 when not locked. */
  retryAfter(user: LockableUser | null, username: string, channel: LoginChannel): number {
    const until = user
      ? (channel === 'showroom' ? user.showroomLockedUntil : user.lockedUntil)?.getTime() ?? 0
      : this.ghosts.get(`${channel}:${username}`)?.lockedUntil ?? 0;
    const remaining = until - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /** Records a failure; returns true when this failure triggered a lock. */
  async registerFailure(user: LockableUser | null, username: string, channel: LoginChannel): Promise<boolean> {
    if (!user) return this.ghostFailure(`${channel}:${username}`);
    const lockUntil = new Date(Date.now() + this.lockMs);
    if (channel === 'showroom') {
      const { showroomFailedCount } = await this.prisma.user.update({
        where: { id: user.id },
        data: { showroomFailedCount: { increment: 1 } },
        select: { showroomFailedCount: true },
      });
      if (showroomFailedCount < this.maxAttempts) return false;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { showroomFailedCount: 0, showroomLockedUntil: lockUntil },
      });
      return true;
    }
    const { failedLoginCount } = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (failedLoginCount < this.maxAttempts) return false;
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: lockUntil } });
    return true;
  }

  async registerSuccess(user: LockableUser, channel: LoginChannel): Promise<void> {
    const dirty = channel === 'showroom'
      ? user.showroomFailedCount > 0 || user.showroomLockedUntil !== null
      : user.failedLoginCount > 0 || user.lockedUntil !== null;
    if (!dirty) return;
    await this.prisma.user.update({
      where: { id: user.id },
      data: channel === 'showroom'
        ? { showroomFailedCount: 0, showroomLockedUntil: null }
        : { failedLoginCount: 0, lockedUntil: null },
    });
  }

  private ghostFailure(key: string): boolean {
    const now = Date.now();
    const entry = this.ghosts.get(key) ?? { count: 0, lockedUntil: 0 };
    if (entry.lockedUntil && entry.lockedUntil <= now) entry.lockedUntil = 0;
    entry.count += 1;
    let locked = false;
    if (entry.count >= this.maxAttempts) {
      entry.count = 0;
      entry.lockedUntil = now + this.lockMs;
      locked = true;
    }
    this.ghosts.delete(key);
    this.ghosts.set(key, entry);
    if (this.ghosts.size > GHOST_LIMIT) {
      const oldest = this.ghosts.keys().next().value;
      if (oldest !== undefined) this.ghosts.delete(oldest);
    }
    return locked;
  }
}
