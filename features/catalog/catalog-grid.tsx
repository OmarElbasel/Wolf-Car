"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useDeferredValue, useMemo, useState } from "react";
import type { PublicProduct } from "@/lib/api/types";

/** Public product grid with a client-side search (image, name, description only). */
export function CatalogGrid({ products }: { products: PublicProduct[] }) {
  const t = useTranslations("ProductsPage");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const visible = useMemo(() => {
    const q = deferred.trim().toLocaleLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.name} ${p.description ?? ""}`.toLocaleLowerCase().includes(q));
  }, [products, deferred]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">{t("search")}</span>
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-[18px] text-muted" aria-hidden="true" strokeWidth={1.8} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="h-11 w-full rounded-[var(--radius-brand)] border-[1.5px] border-line bg-surface ps-10 pe-3 text-[15px] outline-none placeholder:text-muted focus-visible:border-accent-ink"
          />
        </label>
        <p className="text-sm font-semibold text-muted" aria-live="polite">
          {t("count", { count: visible.length })}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[var(--radius-brand-lg)] border border-dashed border-line px-6 py-12 text-center text-ink-2">
          {products.length === 0 ? t("empty") : t("noMatch")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3" data-testid="catalog-grid">
          {visible.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface">
              <div className="relative aspect-[4/3] bg-sand">
                <Image
                  src={p.thumbUrl}
                  alt={p.name}
                  fill
                  sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="p-5">
                <h2 dir="auto" className="text-start text-lg leading-snug font-bold">
                  {p.name}
                </h2>
                {p.description && (
                  <p dir="auto" className="mt-1.5 text-start text-[15px] text-ink-2">
                    {p.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
