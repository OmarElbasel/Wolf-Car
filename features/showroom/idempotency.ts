/**
 * A fresh Idempotency-Key (one per checkout attempt; retries reuse it).
 * crypto.randomUUID() needs a secure context, and a branch tablet might open
 * the kiosk over plain http on the LAN, so fall back to getRandomValues.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
