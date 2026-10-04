/**
 * Month and day maths for the booking calendars. Days are "YYYY-MM-DD" strings
 * (Qatar calendar days) and months are "YYYY-MM"; everything goes through UTC
 * so the viewer's own time zone can never shift a day.
 */
const DAY_MS = 86_400_000;
const utc = (day: string) => new Date(`${day}T00:00:00.000Z`);
const str = (date: Date) => date.toISOString().slice(0, 10);
const tag = (locale: string) => `${locale === "ar" ? "ar" : "en"}-QA-u-nu-latn`;

export const monthOf = (day: string): string => day.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [year, m] = month.split("-").map(Number);
  return str(new Date(Date.UTC(year, m - 1 + n, 1))).slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: str(new Date(Date.UTC(year, m, 0))) };
}

/** The month's days, preceded by one null per empty cell: weeks start on Saturday. */
export function monthCells(month: string): (string | null)[] {
  const { from, to } = monthRange(month);
  const cells: (string | null)[] = Array.from({ length: (utc(from).getUTCDay() + 1) % 7 }, () => null);
  for (let t = utc(from).getTime(); t <= utc(to).getTime(); t += DAY_MS) cells.push(str(new Date(t)));
  return cells;
}

/** Short weekday names, Saturday first (3 January 2026 is a Saturday). */
export function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(tag(locale), { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2026, 0, 3 + i))));
}

export function formatDay(day: string, locale: string, style: "full" | "short" = "full"): string {
  const options: Intl.DateTimeFormatOptions =
    style === "full" ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { weekday: "short", day: "numeric", month: "short" };
  return new Intl.DateTimeFormat(tag(locale), { ...options, timeZone: "UTC" }).format(utc(day));
}

export function formatMonth(month: string, locale: string): string {
  return new Intl.DateTimeFormat(tag(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(utc(`${month}-01`));
}
