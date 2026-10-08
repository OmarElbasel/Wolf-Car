/**
 * The services and packages the shop starts with, from the accountant's price
 * sheet (October 2026). Written to the database once, when it holds no service
 * yet; from then on the dashboard is where names and prices are changed.
 */

export const SECTIONS = ['ppfParts', 'ppfPartial', 'ppfFull', 'glass', 'tint', 'care', 'blackEdition', 'paint'] as const;
export type Section = (typeof SECTIONS)[number];

export const TIER_SETS = ['ppf', 'tint', 'model'] as const;
export type TierSet = (typeof TIER_SETS)[number];

export const BODIES = ['sedan', 'suv'] as const;
export type Body = (typeof BODIES)[number];

/** How a car type is written in an order line. */
export const BODY_AR: Record<Body, string> = { sedan: 'سيدان', suv: 'SUV' };

export const DEFAULT_TIERS: Record<TierSet, { nameAr: string; nameEn: string }[]> = {
  ppf: [
    { nameAr: 'البكج الأول · Xpel', nameEn: 'Package 1 · Xpel' },
    { nameAr: 'البكج الثاني · Onyx', nameEn: 'Package 2 · Onyx' },
    { nameAr: 'البكج الثالث · Ultra Guard', nameEn: 'Package 3 · Ultra Guard' },
  ],
  tint: [
    { nameAr: 'CARONIC', nameEn: 'CARONIC' },
    { nameAr: 'SANTEK', nameEn: 'SANTEK' },
    { nameAr: 'Xpel', nameEn: 'Xpel' },
  ],
  model: [
    { nameAr: 'ليوبارد 5', nameEn: 'Leopard 5' },
    { nameAr: 'ليوبارد 8', nameEn: 'Leopard 8' },
    { nameAr: 'ليوبارد 7', nameEn: 'Leopard 7' },
  ],
};

export interface DefaultService {
  section: Section;
  nameAr: string;
  nameEn: string;
  noteAr?: string;
  noteEn?: string;
  /** which of the shop's posters is shown with it */
  poster?: string;
  tierSet?: TierSet;
  bodySplit?: boolean;
  /**
   * QAR, tier by tier in DEFAULT_TIERS order; with bodySplit each tier is a
   * [sedan, suv] pair. A service with no tier set has a single price.
   */
  prices: (number | [number, number])[];
}

/** A PPF part: [sedan, suv] for package 1, 2 and 3. */
const ppf = (section: Section, nameAr: string, nameEn: string, p1: [number, number], p2: [number, number], p3: [number, number]): DefaultService => ({
  section,
  nameAr,
  nameEn,
  tierSet: 'ppf',
  bodySplit: true,
  prices: [p1, p2, p3],
});

/** A tint job: [sedan, suv] for CARONIC, SANTEK and Xpel. */
const tint = (nameAr: string, nameEn: string, caronic: [number, number], santek: [number, number], xpel: [number, number]): DefaultService => ({
  section: 'tint',
  nameAr,
  nameEn,
  tierSet: 'tint',
  bodySplit: true,
  prices: [caronic, santek, xpel],
});

const single = (section: Section, nameAr: string, nameEn: string, price: number): DefaultService => ({ section, nameAr, nameEn, prices: [price] });

export const DEFAULT_SERVICES: DefaultService[] = [
  ppf('ppfParts', 'مرايا (زوج)', 'Mirrors (pair)', [350, 400], [250, 300], [150, 200]),
  ppf('ppfParts', 'مقابض الأبواب', 'Door handles', [300, 350], [200, 250], [100, 150]),
  ppf('ppfParts', 'الصدام الواحد', 'One bumper', [1800, 2000], [1500, 1700], [800, 1000]),
  ppf('ppfParts', 'الرفرف الأمامي', 'Front fender', [1000, 1200], [500, 700], [300, 400]),
  ppf('ppfParts', 'الرفرف الخلفي', 'Rear fender', [1800, 2000], [1500, 1700], [800, 1000]),
  ppf('ppfParts', 'غطاء المحرك (الكبوت)', 'Hood', [1400, 1500], [1100, 1200], [800, 900]),
  ppf('ppfParts', 'حماية باب واحد', 'One door', [1000, 1200], [500, 700], [300, 400]),
  ppf('ppfParts', 'حماية باب الشنطة', 'Trunk door', [900, 1000], [550, 600], [350, 400]),
  ppf('ppfParts', 'حماية الأنوار الأمامية', 'Headlights', [400, 450], [300, 350], [200, 250]),
  ppf('ppfParts', 'حماية الأنوار الخلفية', 'Tail lights', [400, 450], [300, 350], [200, 250]),
  ppf('ppfParts', 'حماية السقف', 'Roof', [2300, 2500], [1500, 1700], [1000, 1200]),

  {
    ...ppf(
      'ppfPartial',
      'الحماية الأمامية الكاملة (كبوت + رفارف + صدام + مرايا)',
      'Full front protection (hood + fenders + bumper + mirrors)',
      [3499, 3999],
      [2999, 3499],
      [1699, 1999],
    ),
    poster: 'front-full',
  },
  { ...ppf('ppfPartial', 'حماية مقدمة السيارة ربع', 'Quarter front protection', [2999, 3499], [2499, 2999], [1499, 1699]), poster: 'front-quarter' },

  {
    ...ppf('ppfFull', 'الحماية الكاملة للسيارة', 'Full Protection — the whole car', [7999, 8999], [5999, 6999], [4999, 5999]),
    noteAr: 'تشمل عازل حراري CARONIC مجانًا',
    noteEn: 'Includes a free CARONIC window tint',
  },

  single('glass', 'حماية الزجاج الأمامي', 'Windshield protection', 700),

  tint('الزجاج بالكامل', 'All windows', [999, 1199], [2699, 2999], [1699, 1999]),
  tint('الزجاج الأمامي فقط', 'Windshield only', [250, 300], [650, 750], [450, 500]),
  tint('الزجاج الخلفي فقط', 'Rear window only', [250, 300], [650, 750], [450, 500]),
  tint('نافذة واحدة', 'One window', [100, 150], [250, 250], [150, 250]),

  single('care', 'نانو سيراميك — ضمان 5 سنوات', 'Nano ceramic — 5-year warranty', 1800),
  single('care', 'بولش كامل', 'Full polish', 1200),
  single('care', 'بولش خارجي', 'Exterior polish', 600),
  single('care', 'بولش داخلي', 'Interior polish', 600),

  { section: 'blackEdition', nameAr: 'بلاك إديشن', nameEn: 'Black Edition', tierSet: 'model', prices: [700, 1299, 700] },

  single('paint', 'صبغ مطاطي — صدامين ورفارف', 'Rubber paint — both bumpers and fenders', 3400),
  single('paint', 'صبغ عادي — صدامين ورفارف', 'Regular paint — both bumpers and fenders', 2200),
  single('paint', 'صبغ مطاطي — صدام', 'Rubber paint — one bumper', 900),
  single('paint', 'صبغ مطاطي — رفرف', 'Rubber paint — one fender', 400),
  single('paint', 'صبغ عادي — صدام', 'Regular paint — one bumper', 600),
  single('paint', 'صبغ عادي — رفرف (قطعة واحدة)', 'Regular paint — one fender', 250),
  single('paint', 'صبغ عادي — الرنجات', 'Regular paint — all rims', 1800),
  single('paint', 'صبغ مطاطي — الرنجات', 'Rubber paint — all rims', 2200),
  single('paint', 'صبغ مطاطي — رنج واحد', 'Rubber paint — one rim', 450),
  single('paint', 'صبغ عادي — رنج واحد', 'Regular paint — one rim', 380),
];

/**
 * The name an order line, the cashier's screen and a receipt show for one
 * price of a service: "الحماية الكاملة للسيارة · البكج الأول · Xpel · SUV".
 */
export function lineName(serviceNameAr: string, tierNameAr: string | null, body: string | null): string {
  const parts = [serviceNameAr, tierNameAr, body === 'sedan' || body === 'suv' ? BODY_AR[body] : null];
  return parts.filter(Boolean).join(' · ').slice(0, 120);
}
