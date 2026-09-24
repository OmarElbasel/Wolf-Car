"use client";

import { useTranslations } from "next-intl";
import type { ShowroomCategory } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const ALL_CATEGORIES = "__all__";

/**
 * Car-model tabs above the kiosk grid. With well over a thousand products in
 * the catalogue, a flat grid is unusable — the customer picks their car first.
 * Horizontally scrollable so it never wraps into a wall of chips on a kiosk.
 */
export function CategoryTabs({
  categories,
  selected,
  total,
  onSelect,
}: {
  categories: ShowroomCategory[];
  selected: string;
  /** number of products across every category */
  total: number;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("Showroom");
  if (categories.length === 0) return null;

  const tabs = [{ id: ALL_CATEGORIES, name: t("allCategories"), count: total }, ...categories];

  return (
    <div
      role="tablist"
      aria-label={t("categories")}
      className="-mx-4 mb-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:-mx-6 lg:px-6 [scrollbar-width:thin]"
    >
      {tabs.map((c) => {
        const active = c.id === selected;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(c.id)}
            dir="auto"
            className={cn(
              "flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2.5 text-[15px] font-bold whitespace-nowrap transition-colors",
              active ? "border-accent bg-accent text-white" : "border-line bg-surface hover:border-accent",
            )}
          >
            {c.name}
            <span
              className={cn(
                "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs tabular-nums",
                active ? "bg-white/25 text-white" : "bg-sand text-ink-2",
              )}
              aria-hidden="true"
            >
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
