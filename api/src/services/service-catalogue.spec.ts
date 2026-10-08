import { DEFAULT_SERVICES, DEFAULT_TIERS, lineName, SECTIONS } from './service-catalogue';

describe('the starting services (the accountant\'s sheet)', () => {
  it('gives every service one price per column of its row', () => {
    for (const s of DEFAULT_SERVICES) {
      const columns = s.tierSet ? DEFAULT_TIERS[s.tierSet].length : 1;
      expect([s.nameEn, s.prices.length]).toEqual([s.nameEn, columns]);
      // a row priced by car type holds [sedan, suv] pairs, any other row plain amounts
      for (const p of s.prices) expect([s.nameEn, Array.isArray(p)]).toEqual([s.nameEn, s.bodySplit === true]);
    }
  });

  it('never charges a sedan more than an SUV for the same package', () => {
    for (const s of DEFAULT_SERVICES) {
      for (const p of s.prices) if (Array.isArray(p)) expect(p[0]).toBeLessThanOrEqual(p[1]);
    }
  });

  it('holds the sheet\'s headline prices', () => {
    const full = DEFAULT_SERVICES.find((s) => s.section === 'ppfFull')!;
    expect(full.prices).toEqual([[7999, 8999], [5999, 6999], [4999, 5999]]);
    expect(DEFAULT_SERVICES.find((s) => s.section === 'blackEdition')!.prices).toEqual([700, 1299, 700]);
    expect(DEFAULT_SERVICES).toHaveLength(34);
    expect(new Set(DEFAULT_SERVICES.map((s) => s.section))).toEqual(new Set(SECTIONS));
  });
});

describe('lineName', () => {
  it('names an order line by service, package and car type', () => {
    expect(lineName('الحماية الكاملة للسيارة', 'البكج الأول · Xpel', 'suv')).toBe('الحماية الكاملة للسيارة · البكج الأول · Xpel · SUV');
    expect(lineName('بولش كامل', null, null)).toBe('بولش كامل');
  });

  it('never exceeds what a product name may hold', () => {
    expect(lineName('ا'.repeat(80), 'ب'.repeat(40), 'sedan').length).toBeLessThanOrEqual(120);
  });
});
