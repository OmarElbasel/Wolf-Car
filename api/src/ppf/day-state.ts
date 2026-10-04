import { eachDay } from '../common/day';

export type DayState = 'OPEN' | 'FULL' | 'CLOSED';

export interface DayInfo {
  date: string;
  state: DayState;
  /** why the call center closed the day (CLOSED only) */
  reason: string | null;
  lightCount: number;
}

/**
 * The one place that decides what a day looks like, for the dashboard and the
 * sales page alike. A day closed by hand is CLOSED even when it also holds a
 * full PPF; otherwise a full PPF makes it FULL; otherwise it is OPEN.
 * `active` must hold only bookings that are not cancelled.
 */
export function dayStates(
  from: string,
  to: string,
  active: { type: 'FULL' | 'LIGHT'; receiveDate: string }[],
  closed: { date: string; reason: string | null }[],
): DayInfo[] {
  const full = new Set(active.filter((b) => b.type === 'FULL').map((b) => b.receiveDate));
  const light = new Map<string, number>();
  for (const b of active) if (b.type === 'LIGHT') light.set(b.receiveDate, (light.get(b.receiveDate) ?? 0) + 1);
  const closedBy = new Map(closed.map((c) => [c.date, c.reason]));

  return eachDay(from, to).map((date) => {
    const isClosed = closedBy.has(date);
    return {
      date,
      state: isClosed ? 'CLOSED' : full.has(date) ? 'FULL' : 'OPEN',
      reason: isClosed ? (closedBy.get(date) ?? null) : null,
      lightCount: light.get(date) ?? 0,
    };
  });
}
