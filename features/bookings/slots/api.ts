import { buildQuery, toApiError } from "@/lib/api/client";

/**
 * The sales page has no user and no access token: the API reads an httpOnly
 * cookie set when the PIN was typed. So these calls bypass the token logic of
 * `api()` and only send the cookie plus the CSRF header.
 */
const CSRF = { "X-Requested-With": "wolfcar" };

/** Set by the API next to the httpOnly cookie; only says "this phone was probably unlocked". */
export function hasSlotsHint(): boolean {
  return typeof document !== "undefined" && document.cookie.split("; ").some((c) => c.startsWith("wc_slots="));
}

export async function slotsApi<T>(
  path: string,
  options: { method?: "GET" | "POST"; json?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const res = await fetch(`/api/slots${path}${buildQuery(options.query)}`, {
    method: options.method ?? "GET",
    headers: { ...CSRF, ...(options.json !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    credentials: "same-origin",
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}
