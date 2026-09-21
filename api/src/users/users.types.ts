import type { Role } from '../generated/prisma/client';

/** Plaintext credentials, returned exactly once (on create/reset) and never stored. */
export interface IssuedCredentials {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
  branchCode: string | null;
  password?: string;
  showroomPassword?: string;
}

export const USER_VIEW_SELECT = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  role: true,
  isActive: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  lockedUntil: true,
  showroomLockedUntil: true,
  showroomPasswordHash: true,
  createdAt: true,
  branch: { select: { id: true, code: true, name: true, nameAr: true } },
} as const;

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  showroomLockedUntil: Date | null;
  showroomPasswordHash: string | null;
  createdAt: Date;
  branch: { id: string; code: string; name: string; nameAr: string } | null;
};

export function userView(u: UserRow) {
  const now = Date.now();
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    branch: u.branch,
    isActive: u.isActive,
    twoFactorEnabled: u.twoFactorEnabled,
    hasShowroomPassword: u.showroomPasswordHash !== null,
    locked: (u.lockedUntil?.getTime() ?? 0) > now || (u.showroomLockedUntil?.getTime() ?? 0) > now,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

export type UserView = ReturnType<typeof userView>;
