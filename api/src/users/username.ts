import { randomInt } from 'node:crypto';
import type { Prisma, Role } from '../generated/prisma/client';

const SUFFIX = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Readable base username: "admin", "finance", "gh.manager", "gh.cashier". */
export function baseUsername(role: Role, branchCode?: string | null): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'admin';
    case 'FINANCE':
      return 'finance';
    case 'BRANCH_MANAGER':
      return `${(branchCode ?? 'branch').toLowerCase()}.manager`;
    case 'CASHIER':
      return `${(branchCode ?? 'branch').toLowerCase()}.cashier`;
  }
}

/**
 * Auto-generated, unique username. Takes the readable base when it is free,
 * otherwise appends a short random suffix ("gh.manager.k7p2"). Usernames of
 * deleted users stay reserved so audit history remains unambiguous.
 */
export async function generateUsername(
  db: Pick<Prisma.TransactionClient, 'user'>,
  role: Role,
  branchCode?: string | null,
): Promise<string> {
  const base = baseUsername(role, branchCode);
  const candidates = [base];
  for (let i = 0; i < 8; i++) {
    candidates.push(`${base}.${Array.from({ length: 4 }, () => SUFFIX[randomInt(SUFFIX.length)]).join('')}`);
  }
  for (const username of candidates) {
    if (!(await db.user.findUnique({ where: { username }, select: { id: true } }))) return username;
  }
  throw new Error('Could not generate a unique username');
}
