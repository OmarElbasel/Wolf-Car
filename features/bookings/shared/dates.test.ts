import { describe, expect, it } from "vitest";
import { addMonths, formatDay, formatMonth, monthCells, monthOf, monthRange, weekdayNames } from "./dates";

describe("booking date helpers", () => {
  it("knows a month's first and last day, leap years included", () => {
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("steps months across a year boundary", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
    expect(addMonths("2026-11", 12)).toBe("2027-11");
    expect(monthOf("2026-11-02")).toBe("2026-11");
  });

  it("lays a month out with weeks starting on Saturday", () => {
    // 1 November 2026 is a Sunday: one empty cell before it
    const nov = monthCells("2026-11");
    expect(nov.slice(0, 3)).toEqual([null, "2026-11-01", "2026-11-02"]);
    expect(nov).toHaveLength(31);
    // 1 August 2026 is a Saturday: no padding
    expect(monthCells("2026-08")[0]).toBe("2026-08-01");
    // 1 May 2026 is a Friday: six empty cells
    expect(monthCells("2026-05").slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-05-01"]);
  });

  it("names the weekdays Saturday first, in both languages", () => {
    expect(weekdayNames("en")[0]).toMatch(/^Sat/);
    expect(weekdayNames("en")[6]).toMatch(/^Fri/);
    expect(weekdayNames("ar")).toHaveLength(7);
    expect(weekdayNames("ar")[0]).toContain("سبت");
  });

  it("formats a day without shifting it, with Latin digits in Arabic", () => {
    expect(formatDay("2026-11-02", "en")).toMatch(/Monday/);
    expect(formatDay("2026-11-02", "en")).toMatch(/2026/);
    expect(formatDay("2026-11-02", "ar")).toMatch(/2/);
    expect(formatDay("2026-11-02", "ar")).not.toMatch(/[٠-٩]/);
    expect(formatDay("2026-11-02", "en", "short")).not.toMatch(/2026/);
    expect(formatMonth("2026-11", "en")).toMatch(/November 2026/);
  });
});
