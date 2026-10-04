import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { LightJobRequest, Page, PpfCalendar, SalesAccessStatus } from "@/lib/api/types";
import { monthRange } from "../shared/dates";

/** Everything under ["ppf"] is refreshed together after any change. */
export const ppfKeys = {
  all: ["ppf"] as const,
  calendar: (month: string) => ["ppf", "calendar", month] as const,
  requests: ["ppf", "requests"] as const,
  pending: ["ppf", "pending"] as const,
  salesAccess: ["ppf", "sales-access"] as const,
};

export const fetchCalendar = (month: string) => api<PpfCalendar>("/ppf/calendar", { query: monthRange(month) });
export const fetchRequests = () => api<Page<LightJobRequest>>("/ppf/requests", { query: { pageSize: 50 } });
export const fetchSalesAccess = () => api<SalesAccessStatus>("/ppf/sales-access");

/** How many light-job requests are waiting; re-checked every minute. */
export function usePendingRequests(enabled: boolean): number {
  const query = useQuery({
    queryKey: ppfKeys.pending,
    queryFn: () => api<Page<LightJobRequest>>("/ppf/requests", { query: { status: "PENDING", pageSize: 1 } }),
    enabled,
    refetchInterval: 60_000,
  });
  return query.data?.total ?? 0;
}
