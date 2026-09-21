import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateSecret, generateURI, verify } from 'otplib';
import * as QRCode from 'qrcode';
import type { Env } from '../config/env';
import { decryptSecret, encryptSecret, generateRecoveryCode, sha256Hex } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';

export const RECOVERY_CODE_COUNT = 10;

/** ±30 s clock drift is tolerated (one period each way). */
const EPOCH_TOLERANCE = 30;

export interface TwoFactorSetup {
  /** base32 secret for manual entry in the authenticator app */
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get key(): string {
    return this.config.get('TOTP_ENCRYPTION_KEY', { infer: true });
  }

  /** Stores a new pending secret; 2FA stays off until a code from it is verified. */
  async beginSetup(user: { id: string; username: string; twoFactorEnabled: boolean }): Promise<TwoFactorSetup> {
    if (user.twoFactorEnabled) throw new BadRequestException('Two-factor authentication is already enabled.');
    const secret = generateSecret();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorPendingSecretEnc: encryptSecret(secret, this.key) },
    });
    const otpauthUrl = generateURI({ issuer: this.config.get('TOTP_ISSUER', { infer: true }), label: user.username, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1, width: 240 });
    return { secret, otpauthUrl, qrDataUrl };
  }

  /** Verifies a code against the pending secret, turns 2FA on and returns fresh recovery codes (shown once). */
  async enable(userId: string, code: string): Promise<string[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorPendingSecretEnc: true },
    });
    if (user.twoFactorEnabled) throw new BadRequestException('Two-factor authentication is already enabled.');
    if (!user.twoFactorPendingSecretEnc) throw new BadRequestException('Start the setup first.');

    const secret = decryptSecret(user.twoFactorPendingSecretEnc, this.key);
    const result = await verify({ secret, token: code, epochTolerance: EPOCH_TOLERANCE });
    if (!result.valid || !('timeStep' in result)) throw new BadRequestException({ statusCode: 400, error: 'Bad Request', code: 'INVALID_2FA', message: 'The code is not valid. Check the time on your phone and try again.' });

    const codes = this.newRecoveryCodes();
    const pending = user.twoFactorPendingSecretEnc;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecretEnc: pending,
          twoFactorPendingSecretEnc: null,
          twoFactorLastStep: result.timeStep,
        },
      });
      await tx.recoveryCode.deleteMany({ where: { userId } });
      await tx.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: sha256Hex(c) })) });
    });
    return codes;
  }

  /** Checks a TOTP code for login/re-authentication; each time step is accepted only once. */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecretEnc: true, twoFactorLastStep: true },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecretEnc) return false;
    const secret = decryptSecret(user.twoFactorSecretEnc, this.key);
    const result = await verify({
      secret,
      token: code,
      epochTolerance: EPOCH_TOLERANCE,
      ...(user.twoFactorLastStep !== null ? { afterTimeStep: user.twoFactorLastStep } : {}),
    });
    if (!result.valid || !('timeStep' in result)) return false;
    // conditional update closes the race where the same code is submitted twice concurrently
    const claimed = await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: result.timeStep } }],
      },
      data: { twoFactorLastStep: result.timeStep },
    });
    return claimed.count === 1;
  }

  /** Consumes a recovery code (single use). */
  async useRecoveryCode(userId: string, code: string): Promise<boolean> {
    const claimed = await this.prisma.recoveryCode.updateMany({
      where: { userId, codeHash: sha256Hex(code.trim().toLowerCase()), usedAt: null },
      data: { usedAt: new Date() },
    });
    return claimed.count === 1;
  }

  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const codes = this.newRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      await tx.recoveryCode.deleteMany({ where: { userId } });
      await tx.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: sha256Hex(c) })) });
    });
    return codes;
  }

  async remainingRecoveryCodes(userId: string): Promise<number> {
    return this.prisma.recoveryCode.count({ where: { userId, usedAt: null } });
  }

  /** Turns 2FA off and deletes the secret and recovery codes (user disable or admin reset). */
  async disable(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecretEnc: null,
          twoFactorPendingSecretEnc: null,
          twoFactorLastStep: null,
        },
      });
      await tx.recoveryCode.deleteMany({ where: { userId } });
    });
  }

  private newRecoveryCodes(): string[] {
    const codes = new Set<string>();
    while (codes.size < RECOVERY_CODE_COUNT) codes.add(generateRecoveryCode());
    return [...codes];
  }
}
