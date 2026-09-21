import { ApiError } from "./client";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Turns any thrown value into a user-facing, translated message. Stable API
 * error codes map to "Errors.<CODE>"; anything else falls back to a generic
 * message for the status (server details are never shown verbatim in Arabic).
 */
export function errorMessage(error: unknown, t: Translate, has: (key: string) => boolean): string {
  if (error instanceof ApiError) {
    if (error.code && has(`Errors.${error.code}`)) {
      return t(`Errors.${error.code}`, { minutes: Math.ceil((error.retryAfterSeconds ?? 0) / 60) });
    }
    if (error.status === 0 || error.status >= 500) return t("Errors.server");
    if (error.status === 403) return t("Errors.forbidden");
    if (error.status === 404) return t("Errors.notFound");
    if (error.status === 409) return t("Errors.conflict");
    if (error.status === 429) return t("Errors.RATE_LIMITED");
    return error.message;
  }
  if (error instanceof TypeError) return t("Errors.network");
  return t("Errors.server");
}

/** Field-level messages from a VALIDATION_FAILED response, keyed by field path. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.errors.map((e) => [e.field, e.messages[0] ?? ""]));
}
