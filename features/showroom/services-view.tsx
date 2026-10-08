"use client";

import { Check, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { EmptyState } from "@/components/app/states";
import { PosterButton } from "@/components/poster-button";
import { Button } from "@/components/ui/button";
import type { Service, ServiceBody, ServiceCatalog, ShowroomProduct } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { packagePoster, servicePoster } from "@/lib/packages";
import { bySection, localName, localNote, SERVICE_BODIES, serviceLineName, serviceRows } from "@/lib/services";
import { cn } from "@/lib/utils";
import { normalize } from "./filter";

/**
 * Every price of every service as the basket knows it: a product with the
 * service's full name. A service has no barcode and no category.
 */
export function serviceProducts(catalog: ServiceCatalog, locale: string, bodyLabel: (b: ServiceBody) => string): ShowroomProduct[] {
  const tiers = new Map(catalog.tiers.map((t) => [t.id, t]));
  return catalog.services.flatMap((service) =>
    service.prices.flatMap((p) =>
      p.price === null
        ? []
        : [
            {
              id: p.productId,
              name: serviceLineName(service, p.tierId ? (tiers.get(p.tierId) ?? null) : null, p.body, locale, bodyLabel),
              description: null,
              barcode: null,
              categoryId: null,
              price: p.price,
              imageUrl: service.thumbUrl ?? "",
              thumbUrl: service.thumbUrl ?? "",
            },
          ],
    ),
  );
}

/** Services whose name, note or any package name holds every word of the search. */
export function searchServices(catalog: ServiceCatalog, query: string): Service[] {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return catalog.services;
  return catalog.services.filter((s) => {
    const tiers = catalog.tiers.filter((t) => t.set === s.tierSet).map((t) => `${t.nameAr} ${t.nameEn}`);
    const haystack = normalize([s.nameAr, s.nameEn, s.noteAr, s.noteEn, ...tiers].filter(Boolean).join(" "));
    return words.every((w) => haystack.includes(w));
  });
}

/**
 * The kiosk's services and packages: the visitor says sedan or SUV once, then
 * every service lists its packages with a price and an Add button each, so
 * the prices can be compared without opening anything.
 */
export function ServicesView({
  catalog,
  query,
  quantityOf,
  onAdd,
}: {
  catalog: ServiceCatalog;
  query: string;
  quantityOf: (productId: string) => number;
  /** adds the price with this product id; false when the cart limits stopped it */
  onAdd: (productId: string) => boolean;
}) {
  const t = useTranslations("Showroom");
  const [body, setBody] = useState<ServiceBody>("suv");
  const labelId = useId();
  const groups = bySection(searchServices(catalog, query));

  if (groups.length === 0) return <EmptyState title={t("noMatch")} body={t("noMatchHint")} />;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <span id={labelId} className="text-base font-bold text-ink-2">
          {t("bodyLabel")}
        </span>
        <div role="group" aria-labelledby={labelId} className="inline-flex gap-1 rounded-[var(--radius-brand-lg)] border border-line bg-surface p-1">
          {SERVICE_BODIES.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={b === body}
              onClick={() => setBody(b)}
              className={cn(
                "min-h-[52px] touch-manipulation rounded-[var(--radius-brand)] px-7 text-lg font-bold transition-colors",
                b === body ? "bg-accent text-white" : "text-ink-2 hover:bg-sand hover:text-ink",
              )}
            >
              {t(`body.${b}`)}
            </button>
          ))}
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.section} aria-labelledby={`${labelId}-${group.section}`}>
          <h2 id={`${labelId}-${group.section}`} className="mb-3 text-xl leading-tight font-extrabold">
            {t(`section.${group.section}`)}
          </h2>
          {group.section === "ppfFull" ? (
            group.services.map((service) => (
              <PackageCards key={service.id} service={service} catalog={catalog} body={body} quantityOf={quantityOf} onAdd={onAdd} />
            ))
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2 min-[2000px]:grid-cols-3">
              {group.services.map((service) => (
                <li key={service.id} className="grid">
                  <ServiceCard service={service} catalog={catalog} body={body} quantityOf={quantityOf} onAdd={onAdd} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * A complete package gets a card of its own per package, under the shop's
 * poster of it: the poster is where its eight services are spelled out, and a
 * tap opens it full size.
 */
function PackageCards({
  service,
  catalog,
  body,
  quantityOf,
  onAdd,
}: {
  service: Service;
  catalog: ServiceCatalog;
  body: ServiceBody;
  quantityOf: (productId: string) => number;
  onAdd: (productId: string) => boolean;
}) {
  const t = useTranslations("Showroom");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const note = localNote(service, locale);

  return (
    <ul className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-3">
      {serviceRows(service, catalog.tiers, body).map((row) => {
        const quantity = quantityOf(row.productId);
        const name = row.tier ? localName(row.tier, locale) : localName(service, locale);
        const poster = row.tier && packagePoster(catalog.tiers, row.tier.id);
        return (
          <li
            key={row.productId}
            className={cn(
              "flex flex-col overflow-hidden rounded-[var(--radius-brand-lg)] border bg-surface transition-colors",
              quantity > 0 ? "border-accent" : "border-line",
            )}
          >
            {poster && (
              <PosterButton
                poster={poster}
                name={name}
                viewLabel={t("viewPoster", { name })}
                closeLabel={tc("close")}
                sizes="(min-width: 560px) 33vw, 100vw"
                className="border-b border-line"
              />
            )}
            <div className="flex flex-1 flex-col p-4">
              <h3 dir="auto" className="text-start text-lg leading-snug font-extrabold">
                {name}
              </h3>
              <p dir="auto" className="text-start text-sm font-semibold text-ink-2">
                {localName(service, locale)}
              </p>
              <p className="mt-3 text-[28px] leading-none font-extrabold tabular-nums">
                <span dir="ltr">{formatMoney(row.price, locale, { whole: true })}</span>
              </p>
              {note && (
                <p dir="auto" className="mt-2.5 self-start rounded-[var(--radius-brand)] bg-sand px-2.5 py-1 text-start text-sm font-bold text-accent-ink">
                  {note}
                </p>
              )}
              <div className="mt-auto pt-4">
                <Button
                  size="touch"
                  className="w-full"
                  aria-label={t("addNamed", { name: `${localName(service, locale)} · ${name}` })}
                  onClick={() => onAdd(row.productId)}
                >
                  {quantity > 0 ? <Check aria-hidden="true" strokeWidth={2.4} /> : <Plus aria-hidden="true" strokeWidth={2.2} />}
                  {quantity > 0 ? (
                    <>
                      <span aria-hidden="true" className="tabular-nums" data-testid="service-quantity">
                        {quantity}
                      </span>
                      <span className="sr-only">{t("inCart", { count: quantity })}</span>
                    </>
                  ) : (
                    t("add")
                  )}
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ServiceCard({
  service,
  catalog,
  body,
  quantityOf,
  onAdd,
}: {
  service: Service;
  catalog: ServiceCatalog;
  body: ServiceBody;
  quantityOf: (productId: string) => number;
  onAdd: (productId: string) => boolean;
}) {
  const t = useTranslations("Showroom");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const name = localName(service, locale);
  const note = localNote(service, locale);
  const rows = serviceRows(service, catalog.tiers, body);
  const inCart = rows.some((r) => quantityOf(r.productId) > 0);
  const poster = servicePoster(service.poster);

  return (
    <article
      aria-label={name}
      className={cn(
        "flex flex-col overflow-hidden rounded-[var(--radius-brand-lg)] border bg-surface p-4 transition-colors",
        inCart ? "border-accent" : "border-line",
      )}
    >
      {poster && (
        <PosterButton
          poster={poster}
          name={name}
          viewLabel={t("viewPoster", { name })}
          closeLabel={tc("close")}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="-mx-4 -mt-4 mb-4 w-[calc(100%+2rem)] border-b border-line"
        />
      )}
      <h3 dir="auto" className="text-start text-lg leading-snug font-extrabold">
        {name}
      </h3>
      {note && (
        <p dir="auto" className="mt-1.5 self-start rounded-[var(--radius-brand)] bg-sand px-2.5 py-1 text-start text-sm font-bold text-accent-ink">
          {note}
        </p>
      )}
      <ul className="mt-3 grid gap-2">
        {rows.map((row) => {
          const quantity = quantityOf(row.productId);
          const label = row.tier ? localName(row.tier, locale) : null;
          return (
            <li key={row.productId} className="flex items-center gap-3 rounded-[var(--radius-brand)] bg-sand py-2 ps-3.5 pe-2">
              <div className="min-w-0 flex-1">
                {label && (
                  <p dir="auto" className="truncate text-start text-[15px] font-bold text-ink-2">
                    {label}
                  </p>
                )}
                <p className="text-xl leading-tight font-extrabold tabular-nums">
                  <span dir="ltr">{formatMoney(row.price, locale, { whole: true })}</span>
                </p>
              </div>
              <Button
                size="lg"
                className="min-h-[52px] min-w-28 px-4 text-base"
                aria-label={t("addNamed", { name: label ? `${name} · ${label}` : name })}
                onClick={() => onAdd(row.productId)}
              >
                {quantity > 0 ? <Check aria-hidden="true" strokeWidth={2.4} /> : <Plus aria-hidden="true" strokeWidth={2.2} />}
                {quantity > 0 ? (
                  <>
                    <span aria-hidden="true" className="tabular-nums" data-testid="service-quantity">
                      {quantity}
                    </span>
                    <span className="sr-only">{t("inCart", { count: quantity })}</span>
                  </>
                ) : (
                  t("add")
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
