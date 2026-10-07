/**
 * Decides which Odoo product variants belong in this catalogue and maps them
 * onto the shape this database wants. Pure functions only — the import script
 * does the I/O.
 */
import { BARCODE_PATTERN, PRICE_PATTERN, PRODUCT_NAME_MAX } from '../../../shared/validation';
import { normaliseText } from '../legacy-import/legacy-rows';

/** A product.product row as read with VARIANT_FIELDS. Odoo sends `false` for an empty field. */
export interface OdooVariant {
  id: number;
  display_name: string;
  /** The company's own "Arabic Product Name" field; the same for every variant of a product. */
  arabic_name: string | false;
  /** Empty for a product without variants. */
  product_template_variant_value_ids: number[];
  barcode: string | false;
  lst_price: number;
  active: boolean;
  sale_ok: boolean;
  type: string;
  categ_id: [number, string] | false;
}

export const VARIANT_FIELDS = [
  'display_name',
  'arabic_name',
  'product_template_variant_value_ids',
  'barcode', 'lst_price', 'active', 'sale_ok', 'type', 'categ_id',
] as const;

export interface OdooProduct {
  odooId: number;
  name: string;
  barcode: string | null;
  /** QAR with two decimals, e.g. "99.00" */
  price: string;
  categoryOdooId: number | null;
  /** Odoo's full category path, e.g. "Car / LEOPARD / LEOPARD 5" */
  categoryPath: string | null;
  /** Anything the import had to change or drop, reported at the end of the run. */
  warnings: string[];
}

const pathParts = (path: string): string[] =>
  path
    .split('/')
    .map((part) => normaliseText(part))
    .filter(Boolean);

/** Why a variant is left out of the catalogue, or null when it belongs in it. */
export function skipReason(v: OdooVariant): string | null {
  if (!v.active) return 'archived';
  if (!v.sale_ok) return 'not for sale';
  if (v.type === 'service') return 'service';
  if (v.categ_id && pathParts(v.categ_id[1]).some((part) => part.toLowerCase() === 'expenses')) return 'expenses category';
  // 0 and 1 are placeholders in Odoo, not prices
  if (!Number.isFinite(v.lst_price) || v.lst_price <= 1) return 'price is 0 or 1';
  if (!PRICE_PATTERN.test(v.lst_price.toFixed(2))) return 'price out of range';
  if (normaliseText(v.display_name).length < 2) return 'no usable name';
  return null;
}

/**
 * The Arabic name, with the variant's own "(Black)" taken from Odoo's display
 * name: the Arabic field belongs to the product, so variants would otherwise
 * be indistinguishable. Null when Odoo has no Arabic name.
 */
function arabicName(v: OdooVariant): string | null {
  const arabic = normaliseText(v.arabic_name || '');
  if (!arabic) return null;
  const variant = v.product_template_variant_value_ids.length ? /\(([^()]+)\)$/.exec(normaliseText(v.display_name)) : null;
  return variant ? `${arabic} (${variant[1]})` : arabic;
}

/** Maps a variant that passed skipReason. */
export function toProduct(v: OdooVariant): OdooProduct {
  const warnings: string[] = [];

  let name = arabicName(v) ?? normaliseText(v.display_name);
  if (name.length > PRODUCT_NAME_MAX) {
    warnings.push(`name truncated to ${PRODUCT_NAME_MAX} characters`);
    name = name.slice(0, PRODUCT_NAME_MAX);
  }

  let barcode: string | null = (v.barcode ? normaliseText(v.barcode) : '') || null;
  if (barcode && !BARCODE_PATTERN.test(barcode)) {
    warnings.push(`dropped unusable barcode ${JSON.stringify(barcode)}`);
    barcode = null;
  }

  return {
    odooId: v.id,
    name,
    barcode,
    price: v.lst_price.toFixed(2),
    categoryOdooId: v.categ_id ? v.categ_id[0] : null,
    categoryPath: v.categ_id ? v.categ_id[1] : null,
    warnings,
  };
}

/** "Car / LEOPARD / LEOPARD 5" → "LEOPARD 5": the last part is the car model. */
export function categoryName(path: string): string {
  const parts = pathParts(path);
  return (parts.at(-1) ?? normaliseText(path)).slice(0, 120);
}

/** Cars that Odoo names differently from the old catalogue, as legacyCategoryKey output. */
const LEGACY_ALIASES: Readonly<Record<string, string>> = {
  jetour1: 'jetourt1',
  jetour2: 'jetourt2',
  lynk900: 'lyk900',
  v27: 'icar',
  tesla: 'teslaaccessories',
  yu7: 'xiaomiaccessories',
};

/**
 * A comparison key for a category name, so an Odoo category ("LEOPARD 5") can
 * take over the Arabic name and car photo of the old category for the same
 * car ("Leopard 5"). Call it on the Odoo name and on the old English name.
 */
export function legacyCategoryKey(name: string): string {
  const key = normaliseText(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return LEGACY_ALIASES[key] ?? key;
}
