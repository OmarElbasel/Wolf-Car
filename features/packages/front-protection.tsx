"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useState, type ReactNode } from "react";
import { cart, useCart } from "@/features/catalog/cart";
import { QtyStepper } from "@/features/catalog/catalog-grid";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BODY_TYPES, COVERAGES, FLAG_BADGE, FRONT_FILMS, FRONT_POSTERS, frontLineId, type BodyType } from "@/lib/packages";
import { PosterButton } from "./poster";

/**
 * Front protection: the customer picks sedan or SUV once, then each film card
 * lists quarter-front and full-front prices for that car type, each with its
 * own add button. Sedan and SUV are separate basket lines. The section heading
 * (children) sits beside the two posters on wide screens, above them on phones.
 */
export function FrontProtection({ children }: { children?: ReactNode }) {
  const t = useTranslations("Packages");
  const locale = useLocale();
  const items = useCart();
  const [body, setBody] = useState<BodyType>("sedan");
  const labelId = useId();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_auto_1fr] lg:gap-x-8">
      <div>{children}</div>
      <div className="grid max-w-[440px] grid-cols-2 gap-3 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:max-w-none lg:self-start">
        {COVERAGES.map((c) => {
          const name = t("coverageTitle", { coverage: t(`coverage.${c}`) });
          return (
            <figure key={c}>
              <PosterButton
                poster={FRONT_POSTERS[c]}
                name={name}
                sizes="(min-width: 1024px) 185px, (min-width: 480px) 215px, 50vw"
                className="rounded-[var(--radius-brand-lg)] border border-line"
              />
              <figcaption className="mt-1.5 text-center text-sm font-bold text-ink-2">{name}</figcaption>
            </figure>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span id={labelId} className="text-sm font-bold text-ink-2">
          {t("bodyLabel")}
        </span>
        <div role="group" aria-labelledby={labelId} className="inline-flex gap-1 rounded-[var(--radius-brand)] border border-line bg-surface p-1">
          {BODY_TYPES.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={b === body}
              onClick={() => setBody(b)}
              className={cn(
                "min-h-11 rounded-[8px] px-5 text-[15px] font-bold transition-colors",
                b === body ? "bg-accent text-white" : "text-ink-2 hover:bg-sand hover:text-ink",
              )}
            >
              {t(`bodyTypes.${b}`)}
            </button>
          ))}
        </div>
      </div>

      {/* three cards side by side up to lg; beside the posters, one row per film */}
      <ul className="grid gap-3.5 self-start md:grid-cols-3 lg:grid-cols-1 lg:gap-3">
        {FRONT_FILMS.map((f) => {
          const film = t(`films.${f.id}`);
          return (
            <li key={f.id} className="rounded-[var(--radius-brand-lg)] border border-line bg-surface p-5 lg:flex lg:items-center lg:gap-5 lg:py-2.5">
              <div className="mb-2 flex items-center gap-3 lg:mb-0 lg:w-[170px] lg:shrink-0">
                <Image src={FLAG_BADGE[f.origin]} alt="" width={35} height={40} className="h-10 w-auto shrink-0" unoptimized />
                <h3 className="text-[17px] leading-snug font-extrabold">{film}</h3>
              </div>
              <div className="divide-y divide-line lg:flex lg:flex-1 lg:gap-5 lg:divide-y-0">
                {COVERAGES.map((c) => {
                  const id = frontLineId(f.id, c, body);
                  const price = f.prices[c][body];
                  const line = t("lineFront", { coverage: t(`coverage.${c}`), film, body: t(`bodyTypes.${body}`) });
                  const qty = items.find((l) => l.id === id)?.qty ?? 0;
                  return (
                    <div key={c} className="flex min-h-[64px] items-center justify-between gap-3 py-2 lg:flex-1 lg:border-s lg:border-line lg:ps-5">
                      <div className="leading-snug">
                        <p className="text-sm font-semibold text-ink-2">{t(`coverage.${c}`)}</p>
                        <p className="text-[20px] font-extrabold text-accent-ink tabular-nums">{formatMoney(price, locale, { whole: true })}</p>
                      </div>
                      {qty === 0 ? (
                        <button
                          type="button"
                          aria-label={t("addAria", { name: line })}
                          onClick={() => cart.add({ id, name: line, price: price.toFixed(2), thumbUrl: FLAG_BADGE[f.origin] })}
                          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-brand)] bg-charcoal px-4 text-[15px] font-bold text-white transition-colors hover:bg-accent dark:bg-[#2a2723] dark:hover:bg-accent"
                        >
                          <Plus className="size-4" aria-hidden="true" strokeWidth={2.4} />
                          {t("add")}
                        </button>
                      ) : (
                        <QtyStepper id={id} name={line} qty={qty} compact />
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
