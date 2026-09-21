import { describe, expect, it } from "vitest";
import { changedKeys, deepEqual, jsonLines } from "./diff";

describe("deepEqual", () => {
  it("compares JSON values structurally", () => {
    expect(deepEqual({ a: 1, b: [1, { c: "x" }] }, { b: [1, { c: "x" }], a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual("12.50", "12.50")).toBe(true);
    expect(deepEqual({ a: [] }, { a: {} })).toBe(false);
  });
});

describe("changedKeys", () => {
  it("lists changed, added and removed top-level keys in order", () => {
    const before = { name: "Oil filter", price: "10.00", barcode: null, tags: ["a"] };
    const after = { name: "Oil filter", price: "12.50", tags: ["a", "b"], description: "New" };
    expect(changedKeys(before, after)).toEqual(["price", "barcode", "tags", "description"]);
  });

  it("ignores key order and unchanged nested values", () => {
    expect(changedKeys({ a: { x: 1, y: 2 }, b: 1 }, { b: 1, a: { y: 2, x: 1 } })).toEqual([]);
  });

  it("returns nothing when one side is not an object", () => {
    expect(changedKeys(null, { a: 1 })).toEqual([]);
    expect(changedKeys({ a: 1 }, undefined)).toEqual([]);
    expect(changedKeys([1], [2])).toEqual([]);
  });
});

describe("jsonLines", () => {
  it("splits an object per top-level key, keeping nested values together", () => {
    const lines = jsonLines({ name: "X", items: [{ q: 1 }] });
    expect(lines.map((l) => l.key)).toEqual([null, "name", "items", null]);
    expect(lines.map((l) => l.text).join("\n")).toBe(JSON.stringify({ name: "X", items: [{ q: 1 }] }, null, 2));
  });

  it("prints other values as a single block", () => {
    expect(jsonLines(null)).toEqual([{ key: null, text: "null" }]);
    expect(jsonLines([1, 2])).toEqual([{ key: null, text: "[\n  1,\n  2\n]" }]);
    expect(jsonLines({})).toEqual([{ key: null, text: "{}" }]);
    expect(jsonLines(undefined)).toEqual([]);
  });
});
