import { decodeDataUri, normaliseCategory, normaliseProduct, normaliseText } from './legacy-rows';

// 1x1 webp, base64
const WEBP =
  'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

const productRow = (over: Record<string, string> = {}) => ({
  id: 'prod-1',
  category_id: 'cat-1',
  name: 'مصباح أمامي',
  barcode: '1001110056',
  price: '699',
  old_price: '',
  currency: 'QAR',
  image_url: WEBP,
  description: '',
  image_transform: '',
  data: '',
  created_at: '2026-08-19 13:27:49.197+00',
  updated_at: '2026-08-29 08:08:55.293+00',
  ...over,
});

describe('normaliseText', () => {
  it('converts Arabic presentation forms to their standard letters', () => {
    // the legacy export is full of Arabic Presentation Forms-B, which break search
    expect(normaliseText('ﻟﻴﻮﺑﺎرد 5')).toBe('ليوبارد 5');
  });

  it('collapses runs of whitespace and trims', () => {
    expect(normaliseText('  a   b  ')).toBe('a b');
  });

  it('returns an empty string for nullish input', () => {
    expect(normaliseText(undefined)).toBe('');
  });
});

describe('decodeDataUri', () => {
  it('decodes a base64 data URI to bytes and its mime type', () => {
    const decoded = decodeDataUri(WEBP);
    expect(decoded?.mime).toBe('image/webp');
    expect(decoded?.data.subarray(0, 4).toString('ascii')).toBe('RIFF');
  });

  it('rejects a remote URL, a blank value and malformed input', () => {
    expect(decodeDataUri('https://example.com/a.png')).toBeNull();
    expect(decodeDataUri('')).toBeNull();
    expect(decodeDataUri('data:image/webp;base64,')).toBeNull();
  });
});

describe('normaliseProduct', () => {
  it('maps a clean row', () => {
    const p = normaliseProduct(productRow());
    expect(p).toMatchObject({
      legacyId: 'prod-1',
      categoryLegacyId: 'cat-1',
      name: 'مصباح أمامي',
      barcode: '1001110056',
      price: '699.00',
    });
    expect(p.image?.mime).toBe('image/webp');
    expect(p.warnings).toEqual([]);
  });

  it('keeps a barcode that repeats across car models', () => {
    // deliberate in the legacy catalogue: one part listed under several models
    const a = normaliseProduct(productRow({ id: 'prod-1', category_id: 'cat-1' }));
    const b = normaliseProduct(productRow({ id: 'prod-2', category_id: 'cat-2' }));
    expect(a.barcode).toBe(b.barcode);
  });

  it('drops a barcode that is not a barcode, with a warning', () => {
    // one legacy row has the product name typed into the barcode column
    const p = normaliseProduct(productRow({ barcode: 'ﻋﻠﺒﺔ ﻣﻨﺎدﻳﻞ ﻋﺎدﻳﻪ - ﻟﻮن اﻟﺒﻴﺞ' }));
    expect(p.barcode).toBeNull();
    expect(p.warnings.join(' ')).toMatch(/barcode/i);
  });

  it('formats prices to two decimals and rejects unusable ones', () => {
    expect(normaliseProduct(productRow({ price: '6000' })).price).toBe('6000.00');
    expect(normaliseProduct(productRow({ price: '45.5' })).price).toBe('45.50');
    const bad = normaliseProduct(productRow({ price: 'abc' }));
    expect(bad.price).toBeNull();
    expect(bad.warnings.join(' ')).toMatch(/price/i);
  });

  it('truncates an over-long name to the column limit', () => {
    const p = normaliseProduct(productRow({ name: 'x'.repeat(200) }));
    expect(p.name).toHaveLength(120);
    expect(p.warnings.join(' ')).toMatch(/name/i);
  });

  it('warns when the image cannot be decoded', () => {
    const p = normaliseProduct(productRow({ image_url: 'https://example.com/a.png' }));
    expect(p.image).toBeNull();
    expect(p.warnings.join(' ')).toMatch(/image/i);
  });

  it('falls back to the image inside the data column', () => {
    const p = normaliseProduct(
      productRow({ image_url: '', data: JSON.stringify({ imageUrl: WEBP }) }),
    );
    expect(p.image?.mime).toBe('image/webp');
  });

  it('survives an unparseable data column', () => {
    expect(() => normaliseProduct(productRow({ image_url: '', data: '{not json' }))).not.toThrow();
  });
});

describe('normaliseCategory', () => {
  it('maps a category row and keeps its display order', () => {
    const c = normaliseCategory(
      { id: 'cat-1', name: 'ﻟﻴﻮﺑﺎرد 5', car_model: 'ﻟﻴﻮﺑﺎرد 5', order: '3', main_car_image_url: WEBP },
      7,
    );
    expect(c).toMatchObject({ legacyId: 'cat-1', name: 'ليوبارد 5', carModel: 'ليوبارد 5', position: 3 });
    expect(c.image?.mime).toBe('image/webp');
  });

  it('falls back to the row index when order is missing', () => {
    const c = normaliseCategory({ id: 'cat-2', name: 'x', car_model: '', order: '', main_car_image_url: '' }, 7);
    expect(c.position).toBe(7);
    expect(c.carModel).toBeNull();
    expect(c.image).toBeNull();
  });

  it('gives the known legacy categories their English name', () => {
    const c = normaliseCategory({ id: 'cat-1787391894034', name: 'ﻟﻴﻮﺑﺎرد 5', car_model: '', order: '3' }, 0);
    expect(c.nameEn).toBe('Leopard 5');
  });

  it('reuses a Latin-only name as the English one, but never an Arabic one', () => {
    expect(normaliseCategory({ id: 'cat-new', name: 'iCar V23', car_model: '', order: '' }, 0).nameEn).toBe('iCar V23');
    expect(normaliseCategory({ id: 'cat-new', name: 'جيتور X70', car_model: '', order: '' }, 0).nameEn).toBeNull();
  });
});
