"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { PosterButton } from "@/components/poster-button";
import { cart, useCart } from "@/features/catalog/cart";
import { QtyStepper } from "@/features/catalog/catalog-grid";
import type { Service, ServiceBody, ServiceCatalog as Catalog, ServiceSection } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { packagePoster } from "@/lib/packages";
import { bySection, localName, localNote, SERVICE_BODIES, serviceLineName, serviceRows } from "@/lib/services";
import { cn } from "@/lib/utils";

/**
 * Every service and package with its prices (edited in the dashboard). The
 * customer picks sedan or SUV once; each package or film is a row with its
 * own add button, and goes into the same basket as the parts.
 */
export function ServiceCatalog({
  catalog,
  extras = {},
}: {
  catalog: Catalog;
  /** shown under a section's cards, e.g. what every complete package includes */
  extras?: Partial<Record<ServiceSection, ReactNode>>;
}) {
  const t = useTranslations("Packages");
  const [body, setBody] = useState<ServiceBody>("sedan");
  const labelId = useId();

  return (
    <div className="grid gap-12">
      <div className="flex flex-wrap items-center gap-3">
        <span id={labelId} className="text-sm font-bold text-ink-2">
          {t("bodyLabel")}
        </span>
        <div role="group" aria-labelledby={labelId} className="inline-flex gap-1 rounded-[var(--radius-brand)] border border-line bg-surface p-1">
          {SERVICE_BODIES.map((b) => (
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

      {bySection(catalog.services).map((group) => (
        <section key={group.section} id={group.section} aria-labelledby={`${group.section}-title`} className="scroll-mt-24">
          <h2 id={`${group.section}-title`} className="mb-5 text-[clamp(23px,4.6vw,30px)] leading-[1.3] font-extrabold">
            {t(`section.${group.section}`)}
          </h2>
          {group.section === "ppfFull" ? (
            group.services.map((service) => <PackageCards key={service.id} service={service} catalog={catalog} body={body} />)
          ) : (
            <ul className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {group.services.map((service) => (
                <li key={service.id} className="grid">
                  <ServiceCard service={service} catalog={catalog} body={body} />
                </li>
              ))}
            </ul>
          )}
          {extras[group.section]}
        </section>
      ))}
    </div>
  );
}

/**
 * A complete package gets a card of its own per package, under the shop's
 * poster of it: the poster is where its eight services are spelled out.
 */
function PackageCards({ service, catalog, body }: { service: Service; catalog: Catalog; body: ServiceBody }) {
  const t = useTranslations("Packages");
  const locale = useLocale();
  const items = useCart();
  const note = localNote(service, locale);

  return (
    // phones: a swipeable row with the next poster peeking in, so three tall posters don't stack
    <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] md:mx-0 md:grid md:grid-cols-3 md:gap-3.5 md:overflow-visible md:px-0 md:pb-0">
      {serviceRows(service, catalog.tiers, body).map((row) => {
        const qty = items.find((l) => l.id === row.productId)?.qty ?? 0;
        const name = row.tier ? localName(row.tier, locale) : localName(service, locale);
        const line = serviceLineName(service, row.tier, service.bodySplit ? body : null, locale, (b) => t(`bodyTypes.${b}`));
        const poster = row.tier && packagePoster(catalog.tiers, row.tier.id);
        return (
          <li
            key={row.productId}
            className="flex w-[80%] max-w-[340px] shrink-0 snap-center flex-col overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface md:w-auto md:max-w-none"
          >
            {poster && (
              <PosterButton
                poster={poster}
                name={name}
                viewLabel={t("viewPoster", { name })}
                closeLabel={t("close")}
                sizes="(min-width: 768px) 370px, 80vw"
                className="border-b border-line"
              />
            )}
            <div className="flex flex-1 flex-col p-5">
              <h3 dir="auto" className="text-start text-[19px] leading-tight font-extrabold">
                {name}
              </h3>
              <p dir="auto" className="mt-0.5 text-start text-sm font-semibold text-muted">
                {localName(service, locale)}
              </p>
              <p className="mt-4 text-[34px] leading-none font-extrabold tabular-nums">{formatMoney(row.price, locale, { whole: true })}</p>
              {note && (
                <p dir="auto" className="mt-3 self-start rounded-[var(--radius-brand)] bg-sand px-2.5 py-1 text-start text-sm font-bold text-accent-ink">
                  {note}
                </p>
              )}
              <div className="mt-auto pt-5">
                {qty === 0 ? (
                  <button
                    type="button"
                    aria-label={t("addAria", { name: line })}
                    onClick={() => cart.add({ id: row.productId, name: line, price: row.price, thumbUrl: service.thumbUrl ?? "" })}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-brand)] bg-charcoal px-3 text-[16px] font-bold text-white transition-colors hover:bg-accent dark:bg-[#2a2723] dark:hover:bg-accent"
                  >
                    <Plus className="size-[18px]" aria-hidden="true" strokeWidth={2.2} />
                    {t("addToOrder")}
                  </button>
                ) : (
                  <QtyStepper id={row.productId} name={line} qty={qty} />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ServiceCard({ service, catalog, body }: { service: Service; catalog: Catalog; body: ServiceBody }) {
  const t = useTranslations("Packages");
  const locale = useLocale();
  const items = useCart();
  const name = localName(service, locale);
  const note = localNote(service, locale);

  return (
    <article aria-label={name} className="flex flex-col rounded-[var(--radius-brand-lg)] border border-line bg-surface p-5">
      <h3 dir="auto" className="text-start text-[17px] leading-snug font-extrabold">
        {name}
      </h3>
      {note && (
        <p dir="auto" className="mt-2 self-start rounded-[var(--radius-brand)] bg-sand px-2.5 py-1 text-start text-sm font-bold text-accent-ink">
          {note}
        </p>
      )}
      <ul className="mt-4 grid gap-2">
        {serviceRows(service, catalog.tiers, body).map((row) => {
          const qty = items.find((l) => l.id === row.productId)?.qty ?? 0;
          const label = row.tier ? localName(row.tier, locale) : null;
          const line = serviceLineName(service, row.tier, service.bodySplit ? body : null, locale, (b) => t(`bodyTypes.${b}`));
          return (
            <li key={row.productId} className="flex items-center gap-3 rounded-[var(--radius-brand)] bg-sand py-2 ps-3.5 pe-2">
              <div className="min-w-0 flex-1">
                {label && (
                  <p dir="auto" className="truncate text-start text-sm font-bold text-ink-2">
                    {label}
                  </p>
                )}
                <p className="text-[19px] leading-tight font-extrabold tabular-nums">{formatMoney(row.price, locale, { whole: true })}</p>
              </div>
              {qty === 0 ? (
                <button
                  type="button"
                  aria-label={t("addAria", { name: line })}
                  onClick={() => cart.add({ id: row.productId, name: line, price: row.price, thumbUrl: service.thumbUrl ?? "" })}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-brand)] bg-charcoal px-4 text-[15px] font-bold text-white transition-colors hover:bg-accent dark:bg-[#2a2723] dark:hover:bg-accent"
                >
                  <Plus className="size-[18px]" aria-hidden="true" strokeWidth={2.2} />
                  {t("add")}
                </button>
              ) : (
                <QtyStepper id={row.productId} name={line} qty={qty} compact />
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
