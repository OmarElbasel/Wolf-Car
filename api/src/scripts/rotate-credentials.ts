import type { PrismaClient } from '../generated/prisma/client';
import type { PasswordService } from '../auth/password.service';
import { generatePassword } from '../common/crypto';

export interface RotatedCredential {
  username: string;
  displayName: string;
  role: string;
  password: string;
  showroomPassword: string | null;
}

/**
 * One-off, for moving a database to a new environment: every active user gets
 * new generated passwords (a showroom one only if they had one), two-factor is
 * turned off (the new environment has a different TOTP key, so the old secrets
 * cannot be decrypted) and every session is revoked. Returns the new
 * passwords, which are shown once and never stored in plain text.
 */
export async function rotateCredentials(
  prisma: PrismaClient,
  passwords: Pick<PasswordService, 'hash'>,
  generate: () => string = () => generatePassword(),
  now: Date = new Date(),
): Promise<RotatedCredential[]> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { username: 'asc' },
    select: { id: true, username: true, displayName: true, role: true, showroomPasswordHash: true },
  });

  const rows: RotatedCredential[] = [];
  for (const user of users) {
    const password = generate();
    const showroomPassword = user.showroomPasswordHash ? generate() : null;
    const passwordHash = await passwords.hash(password);
    const showroomPasswordHash = showroomPassword ? await passwords.hash(showroomPassword) : null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          ...(showroomPasswordHash ? { showroomPasswordHash } : {}),
          failedLoginCount: 0,
          lockedUntil: null,
          showroomFailedCount: 0,
          showroomLockedUntil: null,
          twoFactorEnabled: false,
          twoFactorSecretEnc: null,
          twoFactorPendingSecretEnc: null,
          twoFactorLastStep: null,
        },
      });
      await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
    });

    rows.push({ username: user.username, displayName: user.displayName, role: user.role, password, showroomPassword });
  }

  await prisma.session.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: now, revokeReason: 'credentials_rotated' },
  });

  return rows;
}
