const SECRET_KEY = /(password|secret|token|recovery|hash)/i;

/** Deep-copies a value into JSON-safe form, replacing secret-looking keys. */
export function toAuditJson(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (depth > 6) return '[truncated]';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toFixed' in value && typeof (value as { toFixed: unknown }).toFixed === 'function' && 'd' in value) {
    return (value as { toFixed: (n: number) => string }).toFixed(2); // Prisma.Decimal
  }
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => toAuditJson(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? '[redacted]' : toAuditJson(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  return value;
}
