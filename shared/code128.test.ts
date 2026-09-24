import { describe, expect, it } from "vitest";
import { CODE128_PATTERN, code128Modules, code128Svg, code128Values, isCode128Encodable } from "./code128";

/** Module strings for the three start codes and the stop code (ISO/IEC 15417). */
const START_B = "11010010000";
const START_C = "11010011100";
const STOP = "1100011101011";

describe("code128Values", () => {
  it("encodes a mixed string in Code B with the documented check symbol", () => {
    // Worked example from the Code 128 specification: PJJ123C -> check symbol 55.
    expect(code128Values("PJJ123C")).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55, 106]);
  });

  it("encodes an even-length digit string in Code C, two digits per symbol", () => {
    // Start C (105) + "12" + "34"; check = (105 + 1*12 + 2*34) mod 103 = 82.
    expect(code128Values("1234")).toEqual([105, 12, 34, 82, 106]);
  });

  it("uses Code C for a real 10-digit catalogue barcode", () => {
    // check = (105 + 1*10 + 2*1 + 3*11 + 4*0 + 5*56) mod 103 = 430 mod 103 = 18
    expect(code128Values("1001110056")).toEqual([105, 10, 1, 11, 0, 56, 18, 106]);
  });

  it("falls back to Code B for an odd-length digit string", () => {
    const values = code128Values("100101768");
    expect(values[0]).toBe(104);
    expect(values).toHaveLength(12); // start + 9 data + check + stop
  });

  it("keeps the check symbol in 0..102", () => {
    for (const v of ["1", "99999999", "AB-12", "100101768", "1001110056"]) {
      const values = code128Values(v);
      const check = values[values.length - 2];
      expect(check).toBeGreaterThanOrEqual(0);
      expect(check).toBeLessThanOrEqual(102);
    }
  });

  it("rejects characters outside printable ASCII", () => {
    expect(() => code128Values("عادي")).toThrow(/encodable/i);
    expect(() => code128Values("")).toThrow(/empty/i);
  });
});

describe("code128Modules", () => {
  it("opens with the start code and closes with the stop code", () => {
    const bars = code128Modules("PJJ123C");
    expect(bars.startsWith(START_B)).toBe(true);
    expect(bars.endsWith(STOP)).toBe(true);
  });

  it("uses the Code C start code for even-length digits", () => {
    expect(code128Modules("1234").startsWith(START_C)).toBe(true);
  });

  it("emits 11 modules per symbol plus 13 for the stop", () => {
    const values = code128Values("1001110056");
    expect(code128Modules("1001110056")).toHaveLength((values.length - 1) * 11 + 13);
  });

  it("always starts and ends on a bar", () => {
    const bars = code128Modules("1001110056");
    expect(bars[0]).toBe("1");
    expect(bars[bars.length - 1]).toBe("1");
  });

  it("has a pattern table of 107 six-module entries", () => {
    expect(CODE128_PATTERN).toHaveLength(107);
    // every symbol is 11 modules wide, except the stop pattern's 13
    CODE128_PATTERN.slice(0, 106).forEach((widths) => {
      expect([...widths].reduce((n, d) => n + Number(d), 0)).toBe(11);
    });
    expect([...CODE128_PATTERN[106]].reduce((n, d) => n + Number(d), 0)).toBe(13);
  });
});

describe("isCode128Encodable", () => {
  it("accepts catalogue barcodes and rejects anything it cannot draw", () => {
    expect(isCode128Encodable("1001110056")).toBe(true);
    expect(isCode128Encodable("AB-12")).toBe(true);
    expect(isCode128Encodable("علبة مناديل")).toBe(false);
    expect(isCode128Encodable("")).toBe(false);
    expect(isCode128Encodable(null)).toBe(false);
  });
});

describe("code128Svg", () => {
  it("renders one rect per bar run inside a sized svg", () => {
    const svg = code128Svg("1001110056");
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('role="img"');
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThan(10);
  });

  it("labels the image with the human-readable code", () => {
    expect(code128Svg("1001110056")).toContain("1001110056");
  });

  it("escapes the label so a barcode can never inject markup", () => {
    // not encodable as CODE128, but the label path must still be safe
    const svg = code128Svg("AB-12", { label: '"><script>alert(1)</script>' });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("omits the caption when showLabel is false", () => {
    expect(code128Svg("1001110056", { showLabel: false })).not.toContain("<text");
  });

  it("returns an empty string for values it cannot encode", () => {
    expect(code128Svg("علبة مناديل")).toBe("");
    expect(code128Svg(null)).toBe("");
  });
});
