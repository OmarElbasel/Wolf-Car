import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DayInfo } from "@/lib/api/types";
import { renderWithApp } from "@/tests/render";
import { MonthCalendar } from "./month-calendar";

const day = (date: string, over: Partial<DayInfo> = {}): DayInfo => ({ date, state: "OPEN", reason: null, lightCount: 0, ...over });
const DAYS: DayInfo[] = Array.from({ length: 30 }, (_, i) => day(`2026-11-${String(i + 1).padStart(2, "0")}`));
DAYS[1] = day("2026-11-02", { state: "FULL", lightCount: 2 });
DAYS[2] = day("2026-11-03", { state: "CLOSED", reason: "National Day" });

const cell = (date: string) => document.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)!;

function setup(props: Partial<Parameters<typeof MonthCalendar>[0]> = {}) {
  const onSelect = vi.fn();
  const onMonthChange = vi.fn();
  const utils = renderWithApp(
    <MonthCalendar month="2026-11" days={DAYS} today="2026-11-02" selected={null} onSelect={onSelect} onMonthChange={onMonthChange} {...props} />,
  );
  return { ...utils, onSelect, onMonthChange };
}

describe("MonthCalendar", () => {
  it("shows every day with its state, in words and not only in colour", () => {
    setup();
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(document.querySelectorAll("button[data-date]")).toHaveLength(30);
    expect(cell("2026-11-01")).toHaveAttribute("data-state", "OPEN");
    expect(cell("2026-11-02")).toHaveAttribute("data-state", "FULL");
    expect(cell("2026-11-02")).toHaveAccessibleName(/Booked/);
    expect(cell("2026-11-02")).toHaveAccessibleName(/2 light jobs/);
    expect(cell("2026-11-03")).toHaveAccessibleName(/Closed/);
    expect(cell("2026-11-02")).toHaveAttribute("aria-current", "date");
  });

  it("selects a day and marks it pressed", async () => {
    const { user, onSelect } = setup({ selected: "2026-11-03" });
    expect(cell("2026-11-03")).toHaveAttribute("aria-pressed", "true");
    await user.click(cell("2026-11-10"));
    expect(onSelect).toHaveBeenCalledWith("2026-11-10");
  });

  it("moves between months and stops at the limits", async () => {
    const { user, onMonthChange } = setup({ minMonth: "2026-11", maxMonth: "2027-11" });
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-12");
  });

  it("days cannot be picked while the month is loading", () => {
    setup({ days: undefined });
    expect(cell("2026-11-01")).toBeDisabled();
  });

  it("renders in Arabic", () => {
    renderWithApp(<MonthCalendar month="2026-11" days={DAYS} today="2026-11-02" selected={null} onSelect={() => undefined} onMonthChange={() => undefined} />, { locale: "ar" });
    expect(screen.getByRole("button", { name: "الشهر التالي" })).toBeInTheDocument();
    expect(cell("2026-11-02")).toHaveAccessibleName(/محجوز/);
  });
});
