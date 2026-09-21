import type { Locale } from "@/i18n/routing";

export type BranchId = "binomran" | "gharrafa";

export interface Branch {
  id: BranchId;
  name: string;
  /** short form without the "branch" prefix, for compact UI like booking pills */
  short: string;
  area: string;
  tel: string;
  wa: string;
  maps: string;
  photoAlt: string;
}

/** Confirmed 2026-09-17. The old Bin Omran number 71009848 is dead — do not use. */
const BRANCHES: Record<Locale, Record<BranchId, Branch>> = {
  ar: {
    binomran: {
      id: "binomran",
      name: "فرع بن عمران",
      short: "بن عمران",
      area: "بن عمران، الدوحة",
      tel: "+97471008939",
      wa: "97471008939",
      maps: "https://www.google.com/maps/search/?api=1&query=8F8V%2B4X%20Doha",
      photoAlt: "واجهة فرع بن عمران",
    },
    gharrafa: {
      id: "gharrafa",
      name: "فرع الغرافة",
      short: "الغرافة",
      area: "سوق الغرافة، الريان",
      tel: "+97471007113",
      wa: "97471007113",
      maps: "https://www.google.com/maps/search/?api=1&query=8FG7%2BRR%20Doha",
      photoAlt: "واجهة فرع الغرافة",
    },
  },
  en: {
    binomran: {
      id: "binomran",
      name: "Bin Omran Branch",
      short: "Bin Omran",
      area: "Bin Omran, Doha",
      tel: "+97471008939",
      wa: "97471008939",
      maps: "https://www.google.com/maps/search/?api=1&query=8F8V%2B4X%20Doha",
      photoAlt: "Bin Omran branch storefront",
    },
    gharrafa: {
      id: "gharrafa",
      name: "Al Gharrafa Branch",
      short: "Al Gharrafa",
      area: "Al Gharrafa Souq, Al Rayyan",
      tel: "+97471007113",
      wa: "97471007113",
      maps: "https://www.google.com/maps/search/?api=1&query=8FG7%2BRR%20Doha",
      photoAlt: "Al Gharrafa branch storefront",
    },
  },
};

const HOURS: Record<Locale, string> = {
  ar: "السبت إلى الخميس 10 ص – 11 م · الجمعة 4 م – 11 م",
  en: "Sat–Thu 10 AM – 11 PM · Fri 4 PM – 11 PM",
};

const GREETING: Record<Locale, string> = {
  ar: "السلام عليكم، تواصلت معكم من الموقع",
  en: "Hello, I'm contacting you from the website",
};

export function getBranches(locale: Locale) {
  return BRANCHES[locale];
}

export function getBranchList(locale: Locale): Branch[] {
  const b = BRANCHES[locale];
  return [b.binomran, b.gharrafa];
}

export function getHours(locale: Locale): string {
  return HOURS[locale];
}

/**
 * Builds a wa.me link. The message MUST go through encodeURIComponent —
 * the old live site skipped it and every "&" in a package name silently
 * truncated the message.
 */
export function waLink(locale: Locale, branch: BranchId, message?: string): string {
  const greeting = GREETING[locale];
  const text = message ? `${greeting}. ${message}` : greeting;
  return `https://wa.me/${BRANCHES[locale][branch].wa}?text=${encodeURIComponent(text)}`;
}

export function telLink(locale: Locale, branch: BranchId): string {
  return `tel:${BRANCHES[locale][branch].tel}`;
}

export function bookingMessage(locale: Locale, branch: BranchId, service: string, where: string): string {
  const b = BRANCHES[locale][branch];
  return locale === "ar"
    ? `أرغب في حجز موعد: ${service}، ${where} (${b.name}).`
    : `I'd like to book an appointment: ${service}, ${where} (${b.name}).`;
}
