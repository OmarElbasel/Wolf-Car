/**
 * Maps rows of the legacy Supabase catalogue export onto the shape this
 * database wants. Pure functions only — the import script does the I/O.
 */
import { BARCODE_PATTERN, PRICE_PATTERN, PRODUCT_NAME_MAX } from '../../../shared/validation';

export interface DecodedImage {
  mime: string;
  data: Buffer;
}

export interface LegacyCategory {
  legacyId: string;
  name: string;
  /** English name for the website's /en pages, or null to show `name`. */
  nameEn: string | null;
  carModel: string | null;
  position: number;
  image: DecodedImage | null;
}

export interface LegacyProduct {
  legacyId: string;
  categoryLegacyId: string;
  name: string;
  barcode: string | null;
  price: string | null;
  image: DecodedImage | null;
  /** Anything the import had to change or drop, reported at the end of the run. */
  warnings: string[];
}

/**
 * Trims, collapses whitespace and applies NFKC. The legacy export stores much
 * of its Arabic as Presentation Forms-B ("ﻟﻴﻮﺑﺎرد"), which renders
 * inconsistently and never matches text a user types — NFKC folds those back
 * to ordinary Arabic letters ("ليوبارد").
 */
export function normaliseText(value: string | null | undefined): string {
  if (!value) return '';
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** Decodes a `data:<mime>;base64,<payload>` URI. Returns null for anything else. */
export function decodeDataUri(value: string | null | undefined): DecodedImage | null {
  if (!value) return null;
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(value.trim());
  if (!match) return null;
  const data = Buffer.from(match[2], 'base64');
  return data.length > 0 ? { mime: match[1], data } : null;
}

/** The legacy `data` column repeats the row as JSON, including a PNG copy of the image. */
function imageFromDataColumn(raw: string | undefined): DecodedImage | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { imageUrl?: string };
    return decodeDataUri(parsed?.imageUrl);
  } catch {
    return null; // a malformed blob must never stop the import
  }
}

export function normaliseProduct(row: Record<string, string>): LegacyProduct {
  const warnings: string[] = [];

  let name = normaliseText(row.name);
  if (name.length > PRODUCT_NAME_MAX) {
    warnings.push(`name truncated to ${PRODUCT_NAME_MAX} characters`);
    name = name.slice(0, PRODUCT_NAME_MAX);
  }

  const rawBarcode = normaliseText(row.barcode);
  let barcode: string | null = rawBarcode || null;
  if (barcode && !BARCODE_PATTERN.test(barcode)) {
    warnings.push(`dropped unusable barcode ${JSON.stringify(barcode)}`);
    barcode = null;
  }

  const price = normalisePrice(row.price, warnings);

  // prefer image_url (webp, already optimised) over the PNG copy in `data`
  const image = decodeDataUri(row.image_url) ?? imageFromDataColumn(row.data);
  if (!image) warnings.push('no usable image');

  return {
    legacyId: row.id,
    categoryLegacyId: row.category_id,
    name,
    barcode,
    price,
    image,
    warnings,
  };
}

function normalisePrice(raw: string | undefined, warnings: string[]): string | null {
  const text = normaliseText(raw);
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) {
    warnings.push(`dropped unusable price ${JSON.stringify(text)}`);
    return null;
  }
  const fixed = value.toFixed(2);
  if (!PRICE_PATTERN.test(fixed)) {
    warnings.push(`dropped out-of-range price ${JSON.stringify(text)}`);
    return null;
  }
  return fixed;
}

/**
 * English names for the legacy categories, which only exist in Arabic. Keyed
 * on the legacy primary key so a rename in the export cannot break the match.
 */
export const CATEGORY_NAMES_EN: Readonly<Record<string, string>> = {
  'cat-1787146025137': 'Genuine Parts',
  'cat-1787212147998': 'Leopard 7',
  'cat-1787386121078': 'iCar',
  'cat-1787391894034': 'Leopard 5',
  'cat-1787558018303': 'Jetour G700',
  'cat-1787846802799': 'Haval H9',
  'cat-1787997080846': 'Rox',
  'cat-1788017745241': 'Tank 700',
  'cat-1788090178403': 'Jetour T2',
  'cat-1788265063552': 'Tank 500',
  'cat-1788281142644': 'Haval V7',
  'cat-1788336866011': 'Leopard 8',
  'cat-1788365049652': 'Jetour T1',
  'cat-1788703417076': 'Xiaomi Accessories',
  'cat-1788707221931': 'Toyota Accessories',
  'cat-1788766067056': 'Defender Accessories',
  'cat-1788767788280': 'Tesla Accessories',
  'cat-1788769009346': 'Xiaomi & Zeekr Accessories',
  'cat-lyk-900': 'LYK-900',
};

/** The known English name, else the name itself when it has no Arabic in it. */
function englishName(legacyId: string, name: string): string | null {
  return CATEGORY_NAMES_EN[legacyId] ?? (/[\u0600-\u06FF]/.test(name) ? null : name);
}

export function normaliseCategory(row: Record<string, string>, index: number): LegacyCategory {
  const order = Number(normaliseText(row.order));
  const name = normaliseText(row.name);
  return {
    legacyId: row.id,
    name,
    nameEn: englishName(row.id, name),
    carModel: normaliseText(row.car_model) || null,
    position: Number.isFinite(order) && normaliseText(row.order) !== '' ? order : index,
    image: decodeDataUri(row.main_car_image_url),
  };
}
