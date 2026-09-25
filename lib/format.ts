/**
 * Locale-aware formatting. Latin digits in both languages (as on the website),
 * Qatar time zone, QAR with 2 decimals.
 */
const tag = (locale: string) => `${locale === "ar" ? "ar" : "en"}-QA-u-nu-latn`;

/** `whole` drops the halalas, for round prices shown large (the protection packages). */
export function formatMoney(amount: string | number | null | undefined, locale: string, { whole = false } = {}): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  return new Intl.NumberFormat(tag(locale), { style: "currency", currency: "QAR", ...(whole && { maximumFractionDigits: 0 }) }).format(
    Number(amount),
  );
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(tag(locale)).format(value);
}

export function formatDateTime(value: string | Date | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qatar" }).format(
    new Date(value),
  );
}

export function formatDate(value: string | Date | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeZone: "Asia/Qatar" }).format(new Date(value));
}

/** "2026-09-21" for the Qatar calendar day of a date (API date filters). */
export function qatarDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Qatar" }).format(date);
}

export function formatRelative(value: string | Date, locale: string, now = Date.now()): string {
  const diff = (new Date(value).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86_400), "day");
}
