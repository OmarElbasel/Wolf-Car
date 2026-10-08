import type { PrismaClient } from '../generated/prisma/client';

interface VariantCode {
  odooTemplateId: number | null;
  variantLabel: string | null;
  barcode: string | null;
}

/**
 * Odoo gives every colour of a product its own barcode: the product's code
 * plus one digit ("1001110016" + "1", "2", …). A branch whose till is not Odoo
 * knows only the product's code. This finds that shared code for each
 * multi-colour product, keyed on the Odoo product (template) id.
 *
 * It is what the colours' barcodes have in common, not simply "minus the last
 * digit": in Odoo a few products have one colour carrying the plain code.
 */
export function baseBarcodes(variants: readonly VariantCode[]): Map<number, string> {
  const byProduct = new Map<number, string[]>();
  for (const v of variants) {
    if (v.odooTemplateId === null || v.variantLabel === null || !v.barcode) continue;
    byProduct.set(v.odooTemplateId, [...(byProduct.get(v.odooTemplateId) ?? []), v.barcode]);
  }
  const bases = new Map<number, string>();
  for (const [id, codes] of byProduct) {
    if (codes.length < 2) continue;
    let shared = codes[0];
    for (const code of codes) {
      let i = 0;
      while (i < shared.length && i < code.length && shared[i] === code[i]) i++;
      shared = shared.slice(0, i);
    }
    // the colour suffix is a digit or two; anything shorter in common means
    // the codes are unrelated and each colour keeps its own
    const shortest = Math.min(...codes.map((c) => c.length));
    if (shared.length >= 4 && shared.length >= shortest - 2) bases.set(id, shared);
  }
  return bases;
}

/** The barcode a branch scans: the shared code for a colour where the branch uses one, else Odoo's. */
export function branchBarcode(product: VariantCode, bases: ReadonlyMap<number, string> | null): string | null {
  if (!bases || product.odooTemplateId === null || product.variantLabel === null) return product.barcode;
  return bases.get(product.odooTemplateId) ?? product.barcode;
}

/**
 * The shared codes for a branch that scans without the colour digit, or null
 * for a branch that uses Odoo's barcodes as they are.
 */
export async function branchBarcodeBases(prisma: Pick<PrismaClient, 'branch' | 'product'>, branchId: string): Promise<Map<number, string> | null> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { barcodeWithoutColour: true } });
  if (!branch?.barcodeWithoutColour) return null;
  return baseBarcodes(
    await prisma.product.findMany({
      where: { isActive: true, variantLabel: { not: null }, barcode: { not: null } },
      select: { odooTemplateId: true, variantLabel: true, barcode: true },
    }),
  );
}
