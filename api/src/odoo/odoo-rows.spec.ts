import { categoryName, legacyCategoryKey, skipReason, toProduct, type OdooVariant } from './odoo-rows';

const variant = (over: Partial<OdooVariant> = {}): OdooVariant => ({
  id: 2729,
  display_name: 'ARM REST COVER (Black)',
  arabic_name: 'غطاء مسند الذراع',
  product_template_variant_value_ids: [235],
  barcode: '10011100161',
  lst_price: 99,
  active: true,
  sale_ok: true,
  type: 'consu',
  categ_id: [29, 'Car / CAR ACCESSORIES'],
  ...over,
});

describe('skipReason', () => {
  it('accepts a sellable, priced good', () => {
    expect(skipReason(variant())).toBeNull();
  });

  it.each([
    [0, 'price is 0 or 1'],
    [1, 'price is 0 or 1'],
    [-5, 'price is 0 or 1'],
    [Number.NaN, 'price is 0 or 1'],
  ])('rejects the placeholder price %p', (lst_price, reason) => {
    expect(skipReason(variant({ lst_price }))).toBe(reason);
  });

  it('accepts a price just above 1', () => {
    expect(skipReason(variant({ lst_price: 1.01 }))).toBeNull();
  });

  it('rejects a price too large for the price column', () => {
    expect(skipReason(variant({ lst_price: 99_999_999_999 }))).toBe('price out of range');
  });

  it('rejects services, archived and not-for-sale products', () => {
    expect(skipReason(variant({ type: 'service' }))).toBe('service');
    expect(skipReason(variant({ active: false }))).toBe('archived');
    expect(skipReason(variant({ sale_ok: false }))).toBe('not for sale');
  });

  it('rejects anything under an Expenses category, however it is spaced or cased', () => {
    expect(skipReason(variant({ categ_id: [5, 'Expenses'] }))).toBe('expenses category');
    expect(skipReason(variant({ categ_id: [6, 'All/expenses / Fuel'] }))).toBe('expenses category');
  });

  it('rejects a product whose name is too short to show', () => {
    expect(skipReason(variant({ display_name: ' x ' }))).toBe('no usable name');
  });
});

describe('toProduct', () => {
  it('maps a clean variant', () => {
    expect(toProduct(variant())).toEqual({
      odooId: 2729,
      name: 'غطاء مسند الذراع (Black)',
      barcode: '10011100161',
      price: '99.00',
      categoryOdooId: 29,
      categoryPath: 'Car / CAR ACCESSORIES',
      warnings: [],
    });
  });

  it('normalises Arabic presentation forms and whitespace in the name', () => {
    expect(toProduct(variant({ arabic_name: '  ﻟﻴﻮﺑﺎرد   5 ', product_template_variant_value_ids: [] })).name).toBe('ليوبارد 5');
  });

  it('uses the Arabic name alone for a product without variants, even when the English name ends in brackets', () => {
    const p = toProduct(variant({ display_name: 'Covers Set (2-PCS)', arabic_name: 'طقم أغطية', product_template_variant_value_ids: [] }));
    expect(p.name).toBe('طقم أغطية');
  });

  it('falls back to the Odoo name when there is no Arabic name', () => {
    expect(toProduct(variant({ arabic_name: false })).name).toBe('ARM REST COVER (Black)');
    expect(toProduct(variant({ arabic_name: '   ' })).name).toBe('ARM REST COVER (Black)');
  });

  it('truncates an over-long name and says so', () => {
    const p = toProduct(variant({ arabic_name: 'x'.repeat(200) }));
    expect(p.name).toHaveLength(120);
    expect(p.warnings).toEqual(['name truncated to 120 characters']);
  });

  it('drops a barcode the app cannot store, keeping the product', () => {
    const p = toProduct(variant({ barcode: '1001 110/056' }));
    expect(p.barcode).toBeNull();
    expect(p.warnings).toEqual(['dropped unusable barcode "1001 110/056"']);
  });

  it('treats a missing barcode and a missing category as empty', () => {
    const p = toProduct(variant({ barcode: false, categ_id: false }));
    expect(p).toMatchObject({ barcode: null, categoryOdooId: null, categoryPath: null, warnings: [] });
  });

  it('rounds the price to two decimals', () => {
    expect(toProduct(variant({ lst_price: 49.999 })).price).toBe('50.00');
  });
});

describe('categoryName', () => {
  it('keeps the last part of the Odoo path', () => {
    expect(categoryName('Car / LEOPARD / LEOPARD 5')).toBe('LEOPARD 5');
    expect(categoryName('Car/XIAOMI/YU7')).toBe('YU7');
    expect(categoryName('THABT')).toBe('THABT');
  });

  it('ignores a trailing separator', () => {
    expect(categoryName('Car / ROX / ')).toBe('ROX');
  });
});

describe('legacyCategoryKey', () => {
  it('matches an Odoo category to the old category of the same car, ignoring case and spacing', () => {
    expect(legacyCategoryKey('LEOPARD 5')).toBe(legacyCategoryKey('Leopard 5'));
    expect(legacyCategoryKey('JETOUR G700')).toBe(legacyCategoryKey('Jetour G700'));
    expect(legacyCategoryKey('ROX')).toBe(legacyCategoryKey('Rox'));
  });

  it('knows the cars Odoo names differently', () => {
    expect(legacyCategoryKey('JETOUR1')).toBe(legacyCategoryKey('Jetour T1'));
    expect(legacyCategoryKey('JETOUR2')).toBe(legacyCategoryKey('Jetour T2'));
    expect(legacyCategoryKey('LYNK 900')).toBe(legacyCategoryKey('LYK-900'));
    expect(legacyCategoryKey('V27')).toBe(legacyCategoryKey('iCar'));
    expect(legacyCategoryKey('TESLA')).toBe(legacyCategoryKey('Tesla Accessories'));
    expect(legacyCategoryKey('YU7')).toBe(legacyCategoryKey('Xiaomi Accessories'));
  });

  it('keeps different cars apart', () => {
    expect(legacyCategoryKey('LEOPARD 5')).not.toBe(legacyCategoryKey('Leopard 8'));
    expect(legacyCategoryKey('LEOPARD')).not.toBe(legacyCategoryKey('Leopard 5'));
  });
});
