/** Columns that say whether a product is one colour/size of a larger product. */
export const VARIANT_SELECT = { odooTemplateId: true, variantLabel: true, variantColor: true } as const;

interface VariantRow {
  odooTemplateId: number | null;
  variantLabel: string | null;
  variantColor: string | null;
}

/** How many cards a list of products makes: the colours of one product count once. */
export function countCards(products: readonly ({ id: string } & VariantRow)[]): number {
  return new Set(products.map((p) => variantView(p).groupId ?? p.id)).size;
}

/**
 * What a screen needs to draw one card with a colour picker: products sharing
 * a groupId are the same product. Null for a product that comes in one form.
 */
export function variantView(p: VariantRow) {
  const grouped = p.odooTemplateId !== null && p.variantLabel !== null;
  return {
    groupId: grouped ? String(p.odooTemplateId) : null,
    variantLabel: grouped ? p.variantLabel : null,
    variantColor: grouped ? p.variantColor : null,
  };
}
