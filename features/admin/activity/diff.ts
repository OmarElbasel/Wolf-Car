/**
 * Tiny helpers for the activity log's before/after panels: which top-level
 * keys changed, and pretty-printed JSON split per top-level key so those
 * lines can be highlighted.
 */

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural equality for JSON values (object key order doesn't matter). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

/**
 * Top-level keys whose value differs between two snapshots (added, removed
 * or changed), in the order they first appear. Only objects can be compared
 * key by key; anything else (e.g. a create with no "before") yields [].
 */
export function changedKeys(before: unknown, after: unknown): string[] {
  if (!isPlainObject(before) || !isPlainObject(after)) return [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.filter((k) => !deepEqual(before[k], after[k]));
}

export interface JsonLine {
  /** the top-level key this line belongs to (null for braces and non-object values) */
  key: string | null;
  text: string;
}

/**
 * Pretty-printed JSON (2-space indent), one entry per top-level key so a
 * changed key can be highlighted as a whole (nested values stay together).
 */
export function jsonLines(value: unknown): JsonLine[] {
  if (value === undefined) return [];
  if (!isPlainObject(value)) return [{ key: null, text: JSON.stringify(value, null, 2) }];
  const keys = Object.keys(value);
  if (keys.length === 0) return [{ key: null, text: "{}" }];
  return [
    { key: null, text: "{" },
    ...keys.map((k, i) => ({
      key: k,
      text: `  ${JSON.stringify(k)}: ${(JSON.stringify(value[k], null, 2) ?? "null").replaceAll("\n", "\n  ")}${i < keys.length - 1 ? "," : ""}`,
    })),
    { key: null, text: "}" },
  ];
}
