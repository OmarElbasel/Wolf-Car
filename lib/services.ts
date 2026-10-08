import type { Service, ServiceBody, ServiceCatalog, ServiceSection, ServiceTier } from "@/lib/api/types";

/** The order the sections are listed in, everywhere services are shown. */
export const SERVICE_SECTIONS: readonly ServiceSection[] = ["ppfFull", "ppfPartial", "ppfParts", "glass", "tint", "care", "blackEdition", "paint"];

export const SERVICE_BODIES: readonly ServiceBody[] = ["sedan", "suv"];

export const localName = (item: { nameAr: string; nameEn: string }, locale: string) => (locale === "ar" ? item.nameAr : item.nameEn);
export const localNote = (service: Pick<Service, "noteAr" | "noteEn">, locale: string) => (locale === "ar" ? service.noteAr : service.noteEn);

export interface ServiceRow {
  /** null for a service with one price */
  tier: ServiceTier | null;
  productId: string;
  price: string;
}

/**
 * The priced rows of a service for one car type: one per package or film, or
 * a single row. A service that is not priced by car type ignores `body`.
 */
export function serviceRows(service: Service, tiers: ServiceTier[], body: ServiceBody): ServiceRow[] {
  const byId = new Map(tiers.map((t) => [t.id, t]));
  return service.prices
    .filter((p) => p.price !== null && (!service.bodySplit || p.body === body))
    .map((p) => ({ tier: p.tierId ? (byId.get(p.tierId) ?? null) : null, productId: p.productId, price: p.price as string }));
}

/** "Full Protection · Package 1 · Xpel · SUV": what a basket line is called. */
export function serviceLineName(service: Service, tier: ServiceTier | null, body: ServiceBody | null, locale: string, bodyLabel: (b: ServiceBody) => string): string {
  return [localName(service, locale), tier && localName(tier, locale), body && bodyLabel(body)].filter(Boolean).join(" · ");
}

/** Services grouped under their section, sections in display order; empty sections are left out. */
export function bySection(services: Service[]): { section: ServiceSection; services: Service[] }[] {
  return SERVICE_SECTIONS.map((section) => ({ section, services: services.filter((s) => s.section === section) })).filter((g) => g.services.length > 0);
}

/** The lowest price a customer can pay for any of these services, or null when none is priced. */
export function lowestPrice(services: Service[]): number | null {
  const prices = services.flatMap((s) => s.prices.flatMap((p) => (p.price === null ? [] : [Number(p.price)])));
  return prices.length ? Math.min(...prices) : null;
}

export const EMPTY_SERVICES: ServiceCatalog = { tiers: [], services: [] };
