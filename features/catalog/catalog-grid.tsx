"use client";

import { Minus, Plus, Search, ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useDeferredValue, useMemo, useState } from "react";
import type { PublicProduct } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cart, MAX_QTY, useCart } from "./cart";

/** Cards rendered per "show more" step; a car model can hold 150+ products. */
const PAGE = 24;

type Sort = "name" | "priceAsc" | "priceDesc";

const byPrice = (dir: 1 | -1) => (a: PublicProduct, b: PublicProduct) => {
  // unpriced products always sink to the end, whichever way the list is sorted
  if (a.price == null || b.price == null) return a.price == null ? (b.price == null ? 0 : 1) : -1;
  return dir * (Number(a.price) - Number(b.price));
};

/** Public product grid: client-side search and sort, prices, and add-to-basket. */
export function CatalogGrid({ products }: { products: PublicProduct[] }) {
  const t = useTranslations("ProductsPage");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [shown, setShown] = useState(PAGE);
  const deferred = useDeferredValue(query);

  const visible = useMemo(() => {
    const q = deferred.trim().toLocaleLowerCase();
    const matched = q
      ? products.filter((p) => `${p.name} ${p.description ?? ""}`.toLocaleLowerCase().includes(q))
      : products;
    return sort === "name" ? matched : [...matched].sort(byPrice(sort === "priceAsc" ? 1 : -1));
  }, [products, deferred, sort]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative block min-w-0 flex-1 basis-60">
          <span className="sr-only">{t("search")}</span>
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-[18px] text-muted" aria-hidden="true" strokeWidth={1.8} />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder={t("search")}
            className="h-11 w-full rounded-[var(--radius-brand)] border-[1.5px] border-line bg-surface ps-10 pe-3 text-[15px] outline-none placeholder:text-muted focus-visible:border-accent-ink"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          {t("sortLabel")}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-11 rounded-[var(--radius-brand)] border-[1.5px] border-line bg-surface px-3 text-[15px] font-semibold text-ink outline-none focus-visible:border-accent-ink"
          >
            <option value="name">{t("sortName")}</option>
            <option value="priceAsc">{t("sortPriceAsc")}</option>
            <option value="priceDesc">{t("sortPriceDesc")}</option>
          </select>
        </label>
        <p className="w-full text-sm font-semibold text-muted sm:ms-auto sm:w-auto" aria-live="polite">
          {t("count", { count: visible.length })}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[var(--radius-brand-lg)] border border-dashed border-line px-6 py-12 text-center text-ink-2">
          {products.length === 0 ? t("empty") : t("noMatch")}
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" data-testid="catalog-grid">
            {visible.slice(0, shown).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ul>
          {visible.length > shown && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="inline-flex min-h-[50px] items-center rounded-[var(--radius-brand)] border-[1.5px] border-line bg-surface px-6 text-[16px] font-bold hover:border-ink"
              >
                {t("showMore", { count: visible.length - shown })}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function ProductCard({ product: p }: { product: PublicProduct }) {
  const t = useTranslations("ProductsPage");
  const locale = useLocale();
  const qty = useCart().find((l) => l.id === p.id)?.qty ?? 0;

  return (
    <li className="group flex flex-col overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface transition-colors hover:border-[#cfcbc4] dark:hover:border-[#4a463f]">
      {/* Most legacy photos are ~200 px wide: shown contained on white at about
          their own size, so they stay sharp instead of being stretched. */}
      <div className="relative aspect-square bg-white">
        <Image
          src={p.imageUrl}
          alt={p.name}
          fill
          sizes="(min-width:1280px) 220px, (min-width:768px) 30vw, 48vw"
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.04] sm:p-5"
          unoptimized
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t border-line p-3 sm:p-3.5">
        <h2 dir="auto" title={p.name} className="line-clamp-2 min-h-[2.7em] text-start text-[15px] leading-[1.35] font-bold">
          {p.name}
        </h2>
        <p className="text-[17px] font-extrabold text-accent-ink tabular-nums">
          {p.price == null ? <span className="text-[15px] text-muted">{t("priceOnRequest")}</span> : formatMoney(p.price, locale)}
        </p>
        <div className="mt-auto">
          {qty === 0 ? (
            <button
              type="button"
              onClick={() => cart.add(p)}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-brand)] bg-charcoal px-3 text-[15px] font-bold text-white transition-colors hover:bg-accent dark:bg-[#2a2723] dark:hover:bg-accent"
            >
              <ShoppingCart className="size-[18px]" aria-hidden="true" strokeWidth={2} />
              {t("addToCart")}
            </button>
          ) : (
            <QtyStepper id={p.id} name={p.name} qty={qty} />
          )}
        </div>
      </div>
    </li>
  );
}

export function QtyStepper({ id, name, qty, compact = false }: { id: string; name: string; qty: number; compact?: boolean }) {
  const t = useTranslations("ProductsPage");
  const step = cn(
    "grid place-items-center text-white transition-colors hover:bg-accent-dark disabled:opacity-40",
    compact ? "size-9" : "h-11 w-11",
  );
  return (
    <div
      role="group"
      aria-label={t("qtyFor", { name })}
      className={cn("flex items-center justify-between overflow-hidden rounded-[var(--radius-brand)] bg-accent", !compact && "w-full")}
    >
      <button type="button" className={step} onClick={() => cart.setQty(id, qty - 1)} aria-label={t("decrease")}>
        <Minus className="size-4" aria-hidden="true" strokeWidth={2.4} />
      </button>
      <span className={cn("text-center font-extrabold text-white tabular-nums", compact ? "min-w-7 text-sm" : "text-base")} aria-live="polite">
        {qty}
      </span>
      <button type="button" className={step} onClick={() => cart.setQty(id, qty + 1)} disabled={qty >= MAX_QTY} aria-label={t("increase")}>
        <Plus className="size-4" aria-hidden="true" strokeWidth={2.4} />
      </button>
    </div>
  );
}
