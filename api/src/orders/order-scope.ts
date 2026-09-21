import type { AuthUser } from '../common/types';
import type { Prisma } from '../generated/prisma/client';

/** Matches nothing: used when a user has no branch to be scoped to. */
const NOTHING: Prisma.OrderWhereInput = { id: { in: [] } };

/**
 * Which orders a user may READ. Branch-scoped users only ever see their own
 * branch, whatever filters or ids they send — a foreign id behaves like a
 * missing one (404).
 */
export function orderReadScope(user: AuthUser): Prisma.OrderWhereInput {
  if (user.role === 'SUPER_ADMIN' || user.permissions.has('order.read.all')) return {};
  if (user.branchId && user.permissions.has('order.read.branch')) return { branchId: user.branchId };
  return NOTHING;
}

/** Receipts: every order for users who can read all branches, otherwise the user's own branch. */
export function orderReceiptScope(user: AuthUser): Prisma.OrderWhereInput {
  if (user.role === 'SUPER_ADMIN' || user.permissions.has('order.read.all')) return {};
  return user.branchId ? { branchId: user.branchId } : NOTHING;
}

/** Which orders a user may CHANGE (update, confirm, cancel): own branch only; Super Admin everywhere. */
export function orderWriteScope(user: AuthUser): Prisma.OrderWhereInput {
  if (user.role === 'SUPER_ADMIN') return {};
  return user.branchId ? { branchId: user.branchId } : NOTHING;
}

export const canReadAllBranches = (user: AuthUser) => user.role === 'SUPER_ADMIN' || user.permissions.has('order.read.all');
