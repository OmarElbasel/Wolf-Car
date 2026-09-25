/**
 * PPF protection packages, from the Bin Omran branch's Instagram posters
 * (September 2026). Prices in QAR. Their names and texts live in the
 * "Packages" messages; this file holds what each option costs.
 *
 * TODO: the posters only give the film's country. The "Standard" / "Premium"
 * in the film names (Packages.films in messages/*.json) are placeholders until
 * the shop sends the real brand names.
 */

export type FilmOrigin = "us" | "de";
export type BodyType = (typeof BODY_TYPES)[number];
export type Coverage = (typeof COVERAGES)[number];

export const BODY_TYPES = ["sedan", "suv"] as const;
export const COVERAGES = ["quarter", "full"] as const;

/**
 * The shop's own Instagram posters (public/assets/packages). They print the
 * prices too, so a price change here needs a new poster.
 */
export interface Poster {
  src: string;
  width: number;
  height: number;
}

const poster = (name: string, width: number, height: number): Poster => ({ src: `/assets/packages/${name}.webp`, width, height });

/** Shield badge with the film's flag, as on the posters (also the basket thumbnail). */
export const FLAG_BADGE: Record<FilmOrigin, string> = {
  us: "/assets/packages/us.svg",
  de: "/assets/packages/de.svg",
};

export interface Bundle {
  /** also its key in Packages.bundleName and Packages.films */
  id: "bundle1" | "bundle2" | "bundle3";
  origin: FilmOrigin;
  price: number;
  poster: Poster;
}

/** Complete protection packages, in the posters' numbering. */
export const BUNDLES: readonly Bundle[] = [
  { id: "bundle1", origin: "us", price: 8999, poster: poster("bundle1", 946, 1684) },
  { id: "bundle2", origin: "de", price: 6999, poster: poster("bundle2", 946, 1688) },
  { id: "bundle3", origin: "us", price: 5999, poster: poster("bundle3", 944, 1688) },
];

/** Purchase coupon that comes with every complete package. */
export const BUNDLE_COUPON = 1000;

/** What every complete package includes, in the posters' order (keys in Packages.services). */
export const BUNDLE_SERVICES = ["fullPpf", "insulation", "windshield", "polish", "seats", "upholstery", "rims", "pickup"] as const;

export interface FrontFilm {
  /** also its key in Packages.films */
  id: "deStandard" | "dePremium" | "us";
  origin: FilmOrigin;
  prices: Record<Coverage, Record<BodyType, number>>;
}

/** Front protection films, cheapest first. */
export const FRONT_FILMS: readonly FrontFilm[] = [
  { id: "deStandard", origin: "de", prices: { quarter: { sedan: 1500, suv: 1700 }, full: { sedan: 1700, suv: 2000 } } },
  { id: "dePremium", origin: "de", prices: { quarter: { sedan: 2500, suv: 3000 }, full: { sedan: 3000, suv: 3500 } } },
  { id: "us", origin: "us", prices: { quarter: { sedan: 3000, suv: 3500 }, full: { sedan: 3500, suv: 4000 } } },
];

/** One poster per coverage, each listing all three films. */
export const FRONT_POSTERS: Record<Coverage, Poster> = {
  quarter: poster("front-quarter", 942, 1684),
  full: poster("front-full", 944, 1688),
};

/** Basket ids; the "pkg:" prefix keeps them apart from the catalogue's product UUIDs. */
export const bundleLineId = (id: Bundle["id"]) => `pkg:${id}`;
export const frontLineId = (film: FrontFilm["id"], coverage: Coverage, body: BodyType) => `pkg:front:${film}:${coverage}:${body}`;

export function lowestPrices() {
  return {
    bundle: Math.min(...BUNDLES.map((b) => b.price)),
    front: Math.min(...FRONT_FILMS.flatMap((f) => COVERAGES.flatMap((c) => BODY_TYPES.map((b) => f.prices[c][b])))),
  };
}
