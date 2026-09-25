import { describe, expect, it } from "vitest";
import { BODY_TYPES, BUNDLES, COVERAGES, FRONT_FILMS, bundleLineId, frontLineId, lowestPrices } from "./packages";

describe("protection packages", () => {
  it("charges more for full front than quarter front, and for an SUV than a sedan", () => {
    for (const f of FRONT_FILMS) {
      for (const body of BODY_TYPES) expect(f.prices.full[body]).toBeGreaterThan(f.prices.quarter[body]);
      for (const c of COVERAGES) expect(f.prices[c].suv).toBeGreaterThan(f.prices[c].sedan);
    }
  });

  it("gives every orderable option its own basket id", () => {
    const ids = [
      ...BUNDLES.map((b) => bundleLineId(b.id)),
      ...FRONT_FILMS.flatMap((f) => COVERAGES.flatMap((c) => BODY_TYPES.map((body) => frontLineId(f.id, c, body)))),
    ];
    expect(ids).toHaveLength(3 + 3 * 2 * 2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("knows the lowest price of each kind, for the 'from' labels", () => {
    expect(lowestPrices()).toEqual({ bundle: 5999, front: 1500 });
  });
});
