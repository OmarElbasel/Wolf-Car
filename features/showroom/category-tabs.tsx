"use client";

import { LayoutGrid, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ShowroomCategory } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const ALL_CATEGORIES = "__all__";
/** the packages and services tab: not a car, and not part of the Odoo catalogue */
export const SERVICES_TAB = "__services__";

/**
 * Car-model tabs above the kiosk grid. With well over a thousand products in
 * the catalogue, a flat grid is unusable — the customer picks their car first.
 * Each tab carries the car's picture or logo, so a visitor finds their car
 * without reading. Horizontally scrollable so it never wraps into a wall of
 * chips on a kiosk.
 */
export function CategoryTabs({
  categories,
  selected,
  total,
  services = 0,
  onSelect,
}: {
  categories: ShowroomCategory[];
  selected: string;
  /** number of products across every category */
  total: number;
  /** how many services and packages there are; the tab is left out at 0 */
  services?: number;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("Showroom");
  if (categories.length === 0 && services === 0) return null;

  const tabs = [
    { id: ALL_CATEGORIES, name: t("allCategories"), count: total, thumbUrl: null },
    ...(services > 0 ? [{ id: SERVICES_TAB, name: t("services"), count: services, thumbUrl: null }] : []),
    ...categories,
  ];

  return (
    <div
      role="tablist"
      aria-label={t("categories")}
      className="-mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 lg:-mx-6 lg:scroll-px-6 lg:px-6 [scrollbar-width:none]"
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
              "flex min-h-[68px] shrink-0 touch-manipulation snap-start items-center gap-3 rounded-[var(--radius-brand-lg)] border-[1.5px] py-2 ps-2 pe-4 text-base font-bold whitespace-nowrap transition-colors",
              active ? "border-accent bg-accent text-white" : "border-line bg-surface hover:border-accent",
            )}
          >
            {/* always white behind the picture: the logos are drawn for a white page */}
            <span
              className={cn(
                "grid h-[52px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-[var(--radius-brand)]",
                c.id === ALL_CATEGORIES && (active ? "bg-white/20" : "bg-sand text-ink-2"),
                c.id === SERVICES_TAB && (active ? "bg-white/20" : "bg-charcoal text-white"),
                c.id !== ALL_CATEGORIES && c.id !== SERVICES_TAB && "bg-white",
              )}
              aria-hidden="true"
            >
              {c.id === ALL_CATEGORIES ? (
                <LayoutGrid className="size-6" strokeWidth={1.8} />
              ) : c.id === SERVICES_TAB ? (
                <ShieldCheck className="size-7" strokeWidth={1.8} />
              ) : c.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- API-served webp rendition; no optimizer round-trip
                <img src={c.thumbUrl} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-contain p-1" />
              ) : (
                <span className="text-lg font-extrabold text-ink-2">{c.name.trim().charAt(0)}</span>
              )}
            </span>
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
