/** Sent by the API for every product; absent only while an older API is still running. */
export interface VariantInfo {
  /** products sharing a groupId are colours/sizes of one product */
  groupId?: string | null;
  /** "أسود" */
  variantLabel?: string | null;
  /** "#060505", when the colour has a swatch */
  variantColor?: string | null;
}

export interface ProductGroup<P> {
  key: string;
  /** the product's name without the colour */
  title: string;
  variants: P[];
}

/**
 * Folds the colours of one product into a single entry, keeping the order of
 * first appearance, so a card can offer a picker instead of repeating itself.
 */
export function groupVariants<P extends VariantInfo & { id: string; name: string }>(products: P[]): ProductGroup<P>[] {
  const groups = new Map<string, ProductGroup<P>>();
  for (const p of products) {
    const key = p.groupId ? `g:${p.groupId}` : `p:${p.id}`;
    const group = groups.get(key);
    if (group) group.variants.push(p);
    else groups.set(key, { key, title: p.name, variants: [p] });
  }
  for (const group of groups.values()) {
    const [first] = group.variants;
    const suffix = ` (${first.variantLabel})`;
    // a product left with one colour (the rest unpriced or filtered out) keeps its full name
    if (group.variants.length > 1 && first.variantLabel && first.name.endsWith(suffix)) {
      group.title = first.name.slice(0, -suffix.length);
    }
  }
  return [...groups.values()];
}
