/**
 * What the packages page says around the price table. The services and their
 * prices themselves are edited in the dashboard (Services & packages) and
 * read from the API: see lib/services.ts and lib/public-catalog.ts.
 */

/** Shield badge with a film's flag, used as the page's emblem. */
export const FLAG_BADGE = {
  us: "/assets/packages/us.svg",
  de: "/assets/packages/de.svg",
} as const;

/** Purchase coupon that comes with every complete package. */
export const BUNDLE_COUPON = 1000;

/** What every complete package includes (keys in Packages.services). */
export const BUNDLE_SERVICES = ["fullPpf", "insulation", "windshield", "polish", "seats", "upholstery", "rims", "screen", "pickup"] as const;

/** One of the shop's own Instagram posters (public/assets/packages). */
export interface Poster {
  src: string;
  width: number;
  height: number;
}

const poster = (name: string): Poster => ({ src: `/assets/packages/${name}.webp`, width: 1400, height: 1400 });

/**
 * The posters of the three complete packages, in package order (البكج الأول,
 * الثاني, الثالث). They print a price too: the SUV price at the time they were
 * made, so a price change in the dashboard needs a new poster.
 */
const PACKAGE_POSTERS: readonly Poster[] = [poster("package-1"), poster("package-2"), poster("package-3")];

/** The poster of a PPF package: the first package of the set gets the first poster, and so on. */
export function packagePoster(tiers: readonly { id: string; set: string }[], tierId: string): Poster | null {
  const index = tiers.filter((t) => t.set === "ppf").findIndex((t) => t.id === tierId);
  return PACKAGE_POSTERS[index] ?? null;
}

/** Posters of single services, by the key a service carries (Service.poster). */
const SERVICE_POSTERS: Record<string, Poster> = {
  "front-full": poster("poster-front-full"),
  "front-quarter": poster("poster-front-quarter"),
};

export const servicePoster = (key: string | null | undefined): Poster | null => (key ? (SERVICE_POSTERS[key] ?? null) : null);
