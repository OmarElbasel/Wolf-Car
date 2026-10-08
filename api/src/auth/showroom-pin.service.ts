import { HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const wrongPin = () =>
  new UnauthorizedException({ statusCode: 401, error: 'Unauthorized', code: 'SHOWROOM_PIN_INVALID', message: 'Wrong PIN.' });

/**
 * The showroom screen's sign-in: its branch and a 6-digit PIN set in the
 * dashboard. Wrong PINs are counted on the branch and lock its sign-in the way
 * account sign-in locks (LOGIN_MAX_ATTEMPTS / LOGIN_LOCK_MINUTES); screens
 * already signed in keep working. A new PIN signs every screen of the branch out.
 */
@Injectable()
export class ShowroomPinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** The branches a screen may sign in to: active, with a PIN. Names only. */
  branches() {
    return this.prisma.branch.findMany({
      where: { isActive: true, showroomPinHash: { not: null } },
      select: { id: true, code: true, name: true, nameAr: true },
      orderBy: { code: 'asc' },
    });
  }

  async setPin(branchId: string, pin: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
    if (!branch) throw new NotFoundException('Branch not found.');
    await this.prisma.branch.update({
      where: { id: branchId },
      data: { showroomPinHash: await this.passwords.hash(pin), showroomPinFailedCount: 0, showroomPinLockedUntil: null },
    });
    // whoever knew the old PIN is signed out
    const users = await this.prisma.user.findMany({ where: { branchId }, select: { id: true } });
    for (const u of users) await this.tokens.revokeUserSessions(u.id, 'showroom_pin_changed', { audience: 'SHOWROOM' });
  }

  /**
   * Throws unless `pin` is the branch's PIN. Every guess first claims one of
   * the LOGIN_MAX_ATTEMPTS slots with a single conditional UPDATE, so a burst
   * of parallel requests cannot evaluate more guesses than the limit.
   */
  async check(branchId: string, pin: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { isActive: true, showroomPinHash: true } });
    if (!branch?.isActive || !branch.showroomPinHash) {
      // same time and same answer as a wrong PIN: says nothing about which branches exist
      await this.passwords.verifyDummy(pin);
      throw wrongPin();
    }
    const max = this.config.get('LOGIN_MAX_ATTEMPTS', { infer: true });
    const lockMs = this.config.get('LOGIN_LOCK_MINUTES', { infer: true }) * 60_000;
    const now = new Date();
    const row = { id: branchId };

    // a lock that has run out gives a fresh set of attempts
    await this.prisma.branch.updateMany({
      where: { ...row, showroomPinLockedUntil: { lte: now } },
      data: { showroomPinLockedUntil: null, showroomPinFailedCount: 0 },
    });
    const claimed = await this.prisma.branch.updateMany({
      where: { ...row, showroomPinLockedUntil: null, showroomPinFailedCount: { lt: max } },
      data: { showroomPinFailedCount: { increment: 1 } },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.branch.findUnique({ where: row, select: { showroomPinLockedUntil: true } });
      const wait = (current?.showroomPinLockedUntil?.getTime() ?? now.getTime() + lockMs) - now.getTime();
      throw new HttpException(
        {
          statusCode: HttpStatus.LOCKED,
          error: 'Locked',
          code: 'SHOWROOM_PIN_LOCKED',
          message: 'Too many wrong PINs. Try again later.',
          retryAfterSeconds: Math.max(1, Math.ceil(wait / 1000)),
        },
        HttpStatus.LOCKED,
      );
    }

    if (!(await this.passwords.verify(branch.showroomPinHash, pin))) {
      // the guess that used the last slot starts the lock
      await this.prisma.branch.updateMany({
        where: { ...row, showroomPinLockedUntil: null, showroomPinFailedCount: { gte: max } },
        data: { showroomPinLockedUntil: new Date(now.getTime() + lockMs) },
      });
      throw wrongPin();
    }
    await this.prisma.branch.updateMany({ where: { ...row, showroomPinLockedUntil: null }, data: { showroomPinFailedCount: 0 } });
  }
}
