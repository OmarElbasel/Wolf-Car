import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditTrail } from '../activity/audit-trail.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import type { AuthUser } from '../common/types';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const ROW = { id: 1 } as const;

/**
 * The shared PIN of the sales slots page. Sales have no accounts: one PIN,
 * typed once per phone, exchanged for a 90-day token. Wrong PINs are counted
 * on the single row and lock unlocking the same way account sign-in locks
 * (LOGIN_MAX_ATTEMPTS / LOGIN_LOCK_MINUTES); phones already unlocked keep working.
 */
@Injectable()
export class SalesAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
    private readonly trail: AuditTrail,
  ) {}

  private row() {
    return this.prisma.salesAccess.upsert({ where: ROW, create: {}, update: {} });
  }

  async status(): Promise<{ pinSet: boolean; updatedAt: Date | null }> {
    const row = await this.row();
    return { pinSet: row.pinHash !== null, updatedAt: row.pinHash ? row.updatedAt : null };
  }

  /** Changing the PIN bumps the version, which signs every phone out. */
  async setPin(user: AuthUser, pin: string): Promise<{ pinSet: boolean; updatedAt: Date | null }> {
    const pinHash = await this.passwords.hash(pin);
    const row = await this.prisma.salesAccess.upsert({
      where: ROW,
      create: { pinHash, updatedById: user.id },
      update: { pinHash, version: { increment: 1 }, failedCount: 0, lockedUntil: null, updatedById: user.id },
    });
    this.trail.setEntity('SalesAccess', '1');
    return { pinSet: true, updatedAt: row.updatedAt };
  }

  /**
   * Every guess first claims one of the LOGIN_MAX_ATTEMPTS slots with a single
   * conditional UPDATE, so a burst of parallel requests cannot evaluate more
   * guesses than the limit: once the slots are gone the PIN is not even checked.
   */
  async unlock(pin: string): Promise<{ token: string; expiresAt: Date }> {
    const row = await this.row();
    this.trail.setEntity('SalesAccess', '1');
    if (!row.pinHash) {
      throw new ConflictException({ statusCode: 409, error: 'Conflict', code: 'SALES_PIN_NOT_SET', message: 'The sales page has no PIN yet.' });
    }
    const max = this.config.get('LOGIN_MAX_ATTEMPTS', { infer: true });
    const lockMs = this.config.get('LOGIN_LOCK_MINUTES', { infer: true }) * 60_000;
    const now = new Date();

    // a lock that has run out gives a fresh set of attempts
    await this.prisma.salesAccess.updateMany({ where: { ...ROW, lockedUntil: { lte: now } }, data: { lockedUntil: null, failedCount: 0 } });
    const claimed = await this.prisma.salesAccess.updateMany({
      where: { ...ROW, lockedUntil: null, failedCount: { lt: max } },
      data: { failedCount: { increment: 1 } },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.salesAccess.findUnique({ where: ROW, select: { lockedUntil: true } });
      const wait = (current?.lockedUntil?.getTime() ?? now.getTime() + lockMs) - now.getTime();
      throw new HttpException(
        {
          statusCode: HttpStatus.LOCKED,
          error: 'Locked',
          code: 'SALES_PIN_LOCKED',
          message: 'Too many wrong PINs. Try again later.',
          retryAfterSeconds: Math.max(1, Math.ceil(wait / 1000)),
        },
        HttpStatus.LOCKED,
      );
    }

    if (!(await this.passwords.verify(row.pinHash, pin))) {
      // the guess that used the last slot starts the lock
      await this.prisma.salesAccess.updateMany({
        where: { ...ROW, lockedUntil: null, failedCount: { gte: max } },
        data: { lockedUntil: new Date(now.getTime() + lockMs) },
      });
      throw new UnauthorizedException({ statusCode: 401, error: 'Unauthorized', code: 'SALES_PIN_INVALID', message: 'Wrong PIN.' });
    }
    await this.prisma.salesAccess.updateMany({ where: { ...ROW, lockedUntil: null }, data: { failedCount: 0 } });
    return this.tokens.signSlots(row.version);
  }

  /** Throws unless the token is a slots token issued for the PIN that is set right now. */
  async verify(token: string | undefined): Promise<void> {
    const version = token ? await this.tokens.verifySlots(token) : null;
    if (version !== null) {
      const row = await this.prisma.salesAccess.findUnique({ where: ROW, select: { version: true, pinHash: true } });
      if (row?.pinHash && row.version === version) return;
    }
    throw new UnauthorizedException({ statusCode: 401, error: 'Unauthorized', code: 'SALES_ACCESS_REQUIRED', message: 'Enter the PIN to continue.' });
  }
}
