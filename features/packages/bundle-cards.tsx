"use client";

import { ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { cart, useCart } from "@/features/catalog/cart";
import { QtyStepper } from "@/features/catalog/catalog-grid";
import { formatMoney } from "@/lib/format";
import { BUNDLE_COUPON, BUNDLES, FLAG_BADGE, bundleLineId } from "@/lib/packages";
import { PosterButton } from "./poster";

/** The three complete protection packages: the shop's poster, then the price and an add-to-basket button. */
export function BundleCards() {
  const t = useTranslations("Packages");
  const locale = useLocale();
  const items = useCart();
  const coupon = formatMoney(BUNDLE_COUPON, locale, { whole: true });

  return (
    // phones: a swipeable row with the next poster peeking in, so three tall posters don't stack
    <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] md:mx-0 md:grid md:grid-cols-3 md:gap-3.5 md:overflow-visible md:px-0 md:pb-0">
      {BUNDLES.map((b) => {
        const id = bundleLineId(b.id);
        const name = t(`bundleName.${b.id}`);
        const film = t(`films.${b.id}`);
        const line = t("lineBundle", { name, film });
        const qty = items.find((l) => l.id === id)?.qty ?? 0;
        return (
          <li
            key={b.id}
            className="flex w-[80%] max-w-[340px] shrink-0 snap-center flex-col overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface md:w-auto md:max-w-none"
          >
            <PosterButton poster={b.poster} name={name} sizes="(min-width: 768px) 370px, 80vw" className="border-b border-line" />
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-center gap-3">
                <Image src={FLAG_BADGE[b.origin]} alt="" width={42} height={48} className="h-12 w-auto shrink-0" unoptimized />
                <div className="min-w-0">
                  <h3 className="text-[19px] leading-tight font-extrabold">{name}</h3>
                  <p className="mt-0.5 text-sm font-semibold text-muted">{film}</p>
                </div>
              </div>
              <p className="mt-5 text-[34px] leading-none font-extrabold tabular-nums">{formatMoney(b.price, locale, { whole: true })}</p>
              <p className="mt-3 self-start rounded-[var(--radius-brand)] bg-sand px-2.5 py-1 text-sm font-bold text-accent-ink">
                {t("coupon", { amount: coupon })}
              </p>
              <div className="mt-auto pt-5">
                {qty === 0 ? (
                  <button
                    type="button"
                    onClick={() => cart.add({ id, name: line, price: b.price.toFixed(2), thumbUrl: FLAG_BADGE[b.origin] })}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-brand)] bg-charcoal px-3 text-[16px] font-bold text-white transition-colors hover:bg-accent dark:bg-[#2a2723] dark:hover:bg-accent"
                  >
                    <ShoppingCart className="size-[18px]" aria-hidden="true" strokeWidth={2} />
                    {t("addToOrder")}
                  </button>
                ) : (
                  <QtyStepper id={id} name={line} qty={qty} />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
