import { describe, expect, it } from "vitest";
import type { Service, ServiceTier } from "@/lib/api/types";
import { bySection, lowestPrice, serviceLineName, serviceRows } from "./services";

const P1: ServiceTier = { id: "t1", set: "ppf", nameAr: "البكج الأول · Xpel", nameEn: "Package 1 · Xpel" };
const P2: ServiceTier = { id: "t2", set: "ppf", nameAr: "البكج الثاني · Onyx", nameEn: "Package 2 · Onyx" };

const service = (over: Partial<Service>): Service => ({
  id: "s",
  section: "ppfParts",
  nameAr: "غطاء المحرك",
  nameEn: "Hood",
  noteAr: null,
  noteEn: null,
  tierSet: null,
  bodySplit: false,
  isActive: true,
  thumbUrl: null,
  prices: [],
  ...over,
});

const FULL = service({
  id: "full",
  section: "ppfFull",
  nameAr: "الحماية الكاملة",
  nameEn: "Full Protection",
  tierSet: "ppf",
  bodySplit: true,
  prices: [
    { productId: "a", tierId: "t1", body: "sedan", price: "7999.00" },
    { productId: "b", tierId: "t1", body: "suv", price: "8999.00" },
    { productId: "c", tierId: "t2", body: "sedan", price: "5999.00" },
    { productId: "d", tierId: "t2", body: "suv", price: null },
  ],
});
const POLISH = service({ id: "polish", section: "care", nameEn: "Full polish", prices: [{ productId: "e", tierId: null, body: null, price: "1200.00" }] });

describe("serviceRows", () => {
  it("lists one row per package for the chosen car type, leaving out an unset price", () => {
    expect(serviceRows(FULL, [P1, P2], "sedan").map((r) => [r.tier?.nameEn, r.productId, r.price])).toEqual([
      ["Package 1 · Xpel", "a", "7999.00"],
      ["Package 2 · Onyx", "c", "5999.00"],
    ]);
    expect(serviceRows(FULL, [P1, P2], "suv").map((r) => r.productId)).toEqual(["b"]);
  });

  it("gives a single-price service the same row for every car type", () => {
    expect(serviceRows(POLISH, [], "suv")).toEqual([{ tier: null, productId: "e", price: "1200.00" }]);
  });
});

describe("serviceLineName", () => {
  const body = (b: string) => b.toUpperCase();
  it("joins the service, the package and the car type in the page's language", () => {
    expect(serviceLineName(FULL, P1, "suv", "en", body)).toBe("Full Protection · Package 1 · Xpel · SUV");
    expect(serviceLineName(FULL, P1, "suv", "ar", body)).toBe("الحماية الكاملة · البكج الأول · Xpel · SUV");
    expect(serviceLineName(POLISH, null, null, "en", body)).toBe("Full polish");
  });
});

describe("bySection", () => {
  it("puts the full packages first and drops sections with nothing in them", () => {
    expect(bySection([POLISH, FULL]).map((g) => [g.section, g.services.map((s) => s.id)])).toEqual([
      ["ppfFull", ["full"]],
      ["care", ["polish"]],
    ]);
  });
});

describe("lowestPrice", () => {
  it("is the cheapest set price, or null when nothing is priced", () => {
    expect(lowestPrice([FULL, POLISH])).toBe(1200);
    expect(lowestPrice([service({})])).toBeNull();
  });
});
