import { http, HttpResponse } from "msw";
import type { DayInfo, LightJobRequest, PpfBooking, PpfCalendar } from "@/lib/api/types";
import { server } from "@/tests/msw";

/** Tests freeze the clock here: 10 March 2031, noon in Qatar. */
export const NOW = new Date("2031-03-10T09:00:00.000Z");
export const TODAY = "2031-03-10";

export const booking = (over: Partial<PpfBooking> = {}): PpfBooking => ({
  id: "b-1",
  type: "FULL",
  status: "BOOKED",
  car: "Land Cruiser 2024",
  ownerName: "Khalid Al-Marri",
  phone: "55123456",
  service: "Bundle 1",
  receiveDate: TODAY,
  deliveryDate: "2031-03-13",
  note: null,
  requestedBy: null,
  createdBy: { id: "u-1", displayName: "Amani" },
  createdAt: "2031-03-01T08:00:00.000Z",
  cancelledAt: null,
  ...over,
});

/** March 2031 as the API would return it for these bookings and closed days. */
export function calendarOf(bookings: PpfBooking[], closed: Record<string, string | null> = {}): PpfCalendar {
  const days: DayInfo[] = Array.from({ length: 31 }, (_, i) => {
    const date = `2031-03-${String(i + 1).padStart(2, "0")}`;
    const active = bookings.filter((b) => b.status === "BOOKED" && b.receiveDate === date);
    const isClosed = date in closed;
    return {
      date,
      state: isClosed ? "CLOSED" : active.some((b) => b.type === "FULL") ? "FULL" : "OPEN",
      reason: isClosed ? closed[date] : null,
      fullCount: active.filter((b) => b.type === "FULL").length,
      lightCount: active.filter((b) => b.type === "LIGHT").length,
    };
  });
  return { today: TODAY, days, bookings };
}

export const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 50, total: items.length });

/** Quiet defaults for everything the page loads besides the calendar. */
export function registerPpfDefaults(requests: LightJobRequest[] = []) {
  server.use(
    http.get("/api/ppf/requests", ({ request }) => {
      const status = new URL(request.url).searchParams.get("status");
      return HttpResponse.json(page(status ? requests.filter((r) => r.status === status) : requests));
    }),
    http.get("/api/ppf/sales-access", () => HttpResponse.json({ pinSet: false, updatedAt: null })),
  );
}
