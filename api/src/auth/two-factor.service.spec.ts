import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mockDeep } from 'jest-mock-extended';
import { generate } from 'otplib';
import { RECOVERY_CODE_PATTERN } from '../../../shared/validation';
import { decryptSecret, encryptSecret, sha256Hex } from '../common/crypto';
import type { PrismaService } from '../prisma/prisma.service';
import { TwoFactorService } from './two-factor.service';

const KEY = Buffer.alloc(32, 3).toString('base64');
const config = new ConfigService({ TOTP_ENCRYPTION_KEY: KEY, TOTP_ISSUER: 'Wolf Car' });
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TwoFactorService', () => {
  const prisma = mockDeep<PrismaService>();
  const service = new TwoFactorService(prisma, config as never);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockResolvedValue([] as never);
  });

  it('stores an encrypted pending secret and returns a QR code', async () => {
    const setup = await service.beginSetup({ id: 'u-1', username: 'gh.cashier', twoFactorEnabled: false });
    expect(setup.otpauthUrl).toMatch(/^otpauth:\/\/totp\/Wolf%20Car:gh.cashier\?/);
    expect(setup.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const stored = prisma.user.update.mock.calls[0][0].data.twoFactorPendingSecretEnc as string;
    expect(stored).not.toContain(setup.secret);
    expect(decryptSecret(stored, KEY)).toBe(setup.secret);
  });

  it('refuses setup when already enabled', async () => {
    await expect(service.beginSetup({ id: 'u-1', username: 'x', twoFactorEnabled: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('enables with a valid code and returns 10 unique recovery codes', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      twoFactorEnabled: false,
      twoFactorPendingSecretEnc: encryptSecret(SECRET, KEY),
    } as never);
    const codes = await service.enable('u-1', await generate({ secret: SECRET }));
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    codes.forEach((c) => expect(c).toMatch(RECOVERY_CODE_PATTERN));
    expect(prisma.recoveryCode.createMany).toHaveBeenCalledWith({
      data: codes.map((c) => ({ userId: 'u-1', codeHash: sha256Hex(c) })),
    });
  });

  it('rejects a wrong code on enable', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      twoFactorEnabled: false,
      twoFactorPendingSecretEnc: encryptSecret(SECRET, KEY),
    } as never);
    await expect(service.enable('u-1', '000000')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a login code once (replay protection via last time step)', async () => {
    const code = await generate({ secret: SECRET });
    prisma.user.findUnique.mockResolvedValue({
      twoFactorEnabled: true,
      twoFactorSecretEnc: encryptSecret(SECRET, KEY),
      twoFactorLastStep: null,
    } as never);
    prisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(service.verifyCode('u-1', code)).resolves.toBe(true);
    const step = (prisma.user.updateMany.mock.calls[0][0].data as { twoFactorLastStep: number }).twoFactorLastStep;

    prisma.user.findUnique.mockResolvedValue({
      twoFactorEnabled: true,
      twoFactorSecretEnc: encryptSecret(SECRET, KEY),
      twoFactorLastStep: step,
    } as never);
    await expect(service.verifyCode('u-1', code)).resolves.toBe(false);
  });

  it('consumes recovery codes exactly once', async () => {
    prisma.recoveryCode.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await expect(service.useRecoveryCode('u-1', ' ABCDE-FGHIJ ')).resolves.toBe(true);
    await expect(service.useRecoveryCode('u-1', 'abcde-fghij')).resolves.toBe(false);
    expect(prisma.recoveryCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u-1', codeHash: sha256Hex('abcde-fghij'), usedAt: null } }),
    );
  });
});
