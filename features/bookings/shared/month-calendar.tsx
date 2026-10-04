"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { DayInfo, DayState } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { addMonths, formatDay, formatMonth, monthCells, weekdayNames } from "./dates";

const STATE_CLASS: Record<DayState, string> = {
  OPEN: "border-line bg-surface hover:border-ink",
  FULL: "border-transparent bg-danger-soft text-danger",
  CLOSED: "border-transparent bg-sand text-muted",
};

/**
 * One month of the PPF calendar, weeks starting on Saturday. Used by the call
 * center's page and by the sales page; it only shows and selects days — what
 * can be done with a day is up to the page. The state is always written out
 * (never colour alone).
 */
export function MonthCalendar({
  month,
  days,
  today,
  selected,
  onSelect,
  onMonthChange,
  minMonth,
  maxMonth,
}: {
  month: string;
  /** undefined while loading: the grid is drawn, the days are disabled */
  days: DayInfo[] | undefined;
  today: string | undefined;
  selected: string | null;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
  minMonth?: string;
  maxMonth?: string;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const byDate = new Map((days ?? []).map((d) => [d.date, d]));
  const title = formatMonth(month, locale);

  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t("previous")}
          disabled={minMonth !== undefined && month <= minMonth}
          onClick={() => onMonthChange(addMonths(month, -1))}
        >
          <ChevronLeft className="rtl:-scale-x-100" aria-hidden="true" />
        </Button>
        <h2 className="text-lg font-extrabold" aria-live="polite">
          {title}
        </h2>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("next")}
          disabled={maxMonth !== undefined && month >= maxMonth}
          onClick={() => onMonthChange(addMonths(month, 1))}
        >
          <ChevronRight className="rtl:-scale-x-100" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-bold text-muted" aria-hidden="true">
        {weekdayNames(locale).map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {monthCells(month).map((date, i) => {
          if (date === null) return <span key={`pad-${i}`} />;
          const info = byDate.get(date);
          const state = info?.state ?? "OPEN";
          const label = [
            formatDay(date, locale),
            info ? t(`states.${state}`) : null,
            info && info.lightCount > 0 ? t("light", { count: info.lightCount }) : null,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              data-state={state}
              aria-label={label}
              aria-pressed={selected === date}
              aria-current={today === date ? "date" : undefined}
              disabled={!info}
              onClick={() => onSelect(date)}
              className={cn(
                "grid min-h-[58px] content-between rounded-[var(--radius-brand)] border-[1.5px] p-1.5 text-start transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink disabled:opacity-50",
                STATE_CLASS[state],
                selected === date && "border-ink ring-2 ring-ink",
                today !== undefined && date < today && "opacity-60",
              )}
            >
              <span className={cn("text-[15px] leading-none font-extrabold tabular-nums", today === date && "underline underline-offset-4")}>
                {Number(date.slice(8))}
              </span>
              <span className="text-[11px] leading-tight font-bold">
                {info && state !== "OPEN" ? t(`states.${state}`) : ""}
                {info && info.lightCount > 0 && <span className="block font-semibold text-ink-2">+{info.lightCount}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-ink-2" aria-hidden="true">
        {(["OPEN", "FULL", "CLOSED"] as const).map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-[4px] border", STATE_CLASS[state])} />
            {t(`states.${state}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
