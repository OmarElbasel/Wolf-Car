import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
  // every visitor starts in Arabic, whatever their device's language; the
  // header's language switch takes them to /en
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
