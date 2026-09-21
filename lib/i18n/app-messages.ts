import type { AbstractIntlMessages } from "next-intl";
import type { Locale } from "@/i18n/routing";

const APP: Record<Locale, () => Promise<AbstractIntlMessages>> = {
  ar: () => import("@/messages/app/ar").then((m) => m.default as AbstractIntlMessages),
  en: () => import("@/messages/app/en").then((m) => m.default as AbstractIntlMessages),
};

const SITE: Record<Locale, () => Promise<AbstractIntlMessages>> = {
  ar: () => import("@/messages/ar.json").then((m) => m.default),
  en: () => import("@/messages/en.json").then((m) => m.default),
};

/**
 * Messages for the staff and showroom pages. They live in messages/app/<locale>/
 * and are sent only to these pages, so the landing page's payload is unchanged.
 * The site's Header/Brand namespaces are included for the shared theme and
 * language toggles.
 */
export async function loadAppMessages(locale: Locale): Promise<AbstractIntlMessages> {
  const [app, site] = await Promise.all([APP[locale](), SITE[locale]()]);
  return { Header: site.Header, Brand: site.Brand, ...app } as AbstractIntlMessages;
}
