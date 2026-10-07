import type { PrismaClient } from '../generated/prisma/client';

/**
 * Appends every imported product to the branch's showroom order, keeping the
 * positions already chosen by the branch manager. Runs in one transaction so
 * the deferred unique (branch_id, position) constraint is checked at commit.
 */
export async function placeInBranch(prisma: PrismaClient, branchId: string, productIds: string[]): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.branchProduct.findMany({
      where: { branchId },
      select: { productId: true, position: true },
    });
    const known = new Set(existing.map((e) => e.productId));
    let next = existing.reduce((max, e) => Math.max(max, e.position), -1) + 1;

    const rows = productIds
      .filter((id) => !known.has(id))
      .map((productId) => ({ branchId, productId, position: next++ }));
    if (rows.length) await tx.branchProduct.createMany({ data: rows });
    return rows.length;
  });
}
