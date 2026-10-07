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
  barcode: string | false;
  lst_price: number;
  active: boolean;
  sale_ok: boolean;
  type: string;
  categ_id: [number, string] | false;
}

export const VARIANT_FIELDS = ['display_name', 'barcode', 'lst_price', 'active', 'sale_ok', 'type', 'categ_id'] as const;

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

/** Maps a variant that passed skipReason. */
export function toProduct(v: OdooVariant): OdooProduct {
  const warnings: string[] = [];

  let name = normaliseText(v.display_name);
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
