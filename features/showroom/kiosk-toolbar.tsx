"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type Filters, PRICE_RANGES, type Sort } from "./filter";

/**
 * The kiosk's search box. The tablet's own keyboard opens on tap; its search
 * key puts the keyboard away again so the results are not hidden behind it.
 */
export function KioskSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations("Showroom");
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute inset-y-0 start-4 my-auto size-6 text-muted" aria-hidden="true" strokeWidth={1.8} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        dir="auto"
        aria-label={t("search")}
        placeholder={t("search")}
        className="h-[60px] w-full rounded-[var(--radius-brand-lg)] border-[1.5px] border-line bg-surface ps-13 pe-16 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-muted focus-visible:border-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("clearSearch")}
          className="absolute inset-y-0 end-1.5 my-auto grid size-12 place-items-center rounded-full text-ink-2 hover:bg-sand"
        >
          <X className="size-6" aria-hidden="true" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-12 shrink-0 touch-manipulation items-center gap-2 rounded-full border px-4 text-[15px] font-bold whitespace-nowrap transition-colors",
        active ? "border-charcoal bg-charcoal text-white dark:border-accent dark:bg-accent" : "border-line bg-surface hover:border-accent",
      )}
    >
      {children}
    </button>
  );
}

/** Sort and price-band chips: one tap turns a chip on, a second tap turns it off. */
export function KioskFilters({ filters, onChange }: { filters: Filters; onChange: (patch: Partial<Filters>) => void }) {
  const t = useTranslations("Showroom");
  const amount = (n: number) => n.toLocaleString("en");
  const toggleSort = (sort: Sort) => onChange({ sort: filters.sort === sort ? "default" : sort });

  return (
    <div
      role="group"
      aria-label={t("filters")}
      className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 lg:-mx-6 lg:px-6 [scrollbar-width:none]"
    >
      <Chip active={filters.sort === "priceAsc"} onClick={() => toggleSort("priceAsc")}>
        <ArrowUpNarrowWide className="size-5" aria-hidden="true" strokeWidth={2} />
        {t("sortPriceAsc")}
      </Chip>
      <Chip active={filters.sort === "priceDesc"} onClick={() => toggleSort("priceDesc")}>
        <ArrowDownWideNarrow className="size-5" aria-hidden="true" strokeWidth={2} />
        {t("sortPriceDesc")}
      </Chip>
      <span className="mx-1 h-7 w-px shrink-0 bg-line" aria-hidden="true" />
      <span className="shrink-0 text-sm font-bold text-ink-2">{t("priceLabel")}</span>
      {PRICE_RANGES.map((r) => (
        <Chip key={r.id} active={filters.range === r.id} onClick={() => onChange({ range: filters.range === r.id ? null : r.id })}>
          <span dir="ltr">
            {r.min === 0
              ? t("priceUnder", { amount: amount(r.max) })
              : r.max === Infinity
                ? t("priceOver", { amount: amount(r.min) })
                : `${amount(r.min)} – ${amount(r.max)}`}
          </span>
        </Chip>
      ))}
    </div>
  );
}
