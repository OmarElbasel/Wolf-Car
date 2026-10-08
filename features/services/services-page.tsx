"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, ErrorState, LoadingRows, NoAccess } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/features/auth/auth-provider";
import { normalizePrice } from "@/features/products/price-dialog";
import { api } from "@/lib/api/client";
import type { Service, ServiceBody, ServiceCatalog, ServicePrice, ServiceTier } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { formatMoney } from "@/lib/format";
import { bySection, localName, SERVICE_BODIES } from "@/lib/services";
import { cn } from "@/lib/utils";
import { PRICE_PATTERN } from "@/shared/validation";
import { fetchServices, serviceKeys } from "./queries";
import { ServiceDialog, TierDialog } from "./service-dialogs";

/**
 * Services and packages (PPF, tint, polish, paint): a price table like the
 * accountant's sheet. They are kept here, not in Odoo; a change shows on the
 * showroom screen and the website's packages page.
 */
export function ServicesPage() {
  const t = useTranslations("Services");
  const { can } = useAuth();
  if (!can("product.read")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess permission="product.read" />
      </>
    );
  }
  return <ServicesManager />;
}

type Editing = { kind: "service"; service: Service | null } | { kind: "tier"; tier: ServiceTier } | null;

function ServicesManager() {
  const t = useTranslations("Services");
  const { can } = useAuth();
  const [editing, setEditing] = useState<Editing>(null);
  const query = useQuery({ queryKey: serviceKeys.all, queryFn: fetchServices });
  const canEdit = can("product.update.details");

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          can("product.create") && (
            <Button onClick={() => setEditing({ kind: "service", service: null })}>
              <Plus aria-hidden="true" strokeWidth={2} />
              {t("add")}
            </Button>
          )
        }
      />
      {query.isPending ? (
        <LoadingRows rows={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.services.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="grid gap-8">
          {bySection(query.data.services).map((group) => (
            <section key={group.section} aria-labelledby={`section-${group.section}`}>
              <h2 id={`section-${group.section}`} className="mb-3 text-lg font-extrabold">
                {t(`section.${group.section}`)}
              </h2>
              <PriceTable
                services={group.services}
                catalog={query.data}
                canEdit={canEdit}
                canPrice={can("product.update.price")}
                onEditService={(service) => setEditing({ kind: "service", service })}
                onEditTier={(tier) => setEditing({ kind: "tier", tier })}
              />
            </section>
          ))}
        </div>
      )}
      <ServiceDialog
        open={editing?.kind === "service"}
        service={editing?.kind === "service" ? editing.service : null}
        onClose={() => setEditing(null)}
      />
      <TierDialog tier={editing?.kind === "tier" ? editing.tier : null} onClose={() => setEditing(null)} />
    </>
  );
}

/** A section's services share their columns: the packages or films, each split by car type when priced that way. */
function PriceTable({
  services,
  catalog,
  canEdit,
  canPrice,
  onEditService,
  onEditTier,
}: {
  services: Service[];
  catalog: ServiceCatalog;
  canEdit: boolean;
  canPrice: boolean;
  onEditService: (service: Service) => void;
  onEditTier: (tier: ServiceTier) => void;
}) {
  const t = useTranslations("Services");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const message = useErrorMessage();

  const sets = [...new Set(services.map((s) => s.tierSet))];
  const tiers = catalog.tiers.filter((tier) => sets.includes(tier.set));
  const columns: (ServiceTier | null)[] = tiers.length ? tiers : [null];
  const split = services.some((s) => s.bodySplit);
  const bodies: (ServiceBody | null)[] = split ? [...SERVICE_BODIES] : [null];

  const cell = (service: Service, tier: ServiceTier | null, body: ServiceBody | null): ServicePrice | undefined =>
    service.prices.find((p) => p.tierId === (service.tierSet ? (tier?.id ?? null) : null) && p.body === (service.bodySplit ? body : null));

  const setActive = async (service: Service, isActive: boolean) => {
    try {
      await api(`/services/${service.id}`, { method: "PATCH", json: { isActive } });
      await queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      toast.success(isActive ? t("shown") : t("hidden"));
    } catch (error) {
      toast.error(message(error));
    }
  };

  return (
    <div className="overflow-x-auto rounded-[var(--radius-brand-lg)] border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-[15px]">
        <thead>
          <tr className="border-b border-line bg-sand text-ink-2">
            <th scope="col" rowSpan={split && tiers.length ? 2 : 1} className="px-4 py-2.5 text-start font-bold">
              {t("service")}
            </th>
            {columns.map((tier) => (
              <th key={tier?.id ?? "price"} scope="colgroup" colSpan={bodies.length} className="border-s border-line px-3 py-2.5 text-center font-bold">
                {tier ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span dir="auto">{localName(tier, locale)}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onEditTier(tier)}
                        aria-label={t("renameNamed", { name: localName(tier, locale) })}
                        className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" strokeWidth={2} />
                      </button>
                    )}
                  </span>
                ) : split ? (
                  t("price")
                ) : (
                  t("priceQar")
                )}
              </th>
            ))}
            <th scope="col" rowSpan={split && tiers.length ? 2 : 1} className="border-s border-line px-3 py-2.5 text-center font-bold">
              {t("visible")}
            </th>
          </tr>
          {split && (
            <tr className="border-b border-line bg-sand text-sm text-ink-2">
              {!tiers.length && <th />}
              {columns.flatMap((tier) =>
                bodies.map((body) => (
                  <th key={`${tier?.id ?? "price"}-${body}`} scope="col" className="border-s border-line px-3 py-1.5 text-center font-semibold">
                    {body && t(`body.${body}`)}
                  </th>
                )),
              )}
              {!tiers.length && <th />}
            </tr>
          )}
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id} className={cn("border-b border-line last:border-b-0", !service.isActive && "opacity-55")}>
              <th scope="row" className="px-4 py-2 text-start font-bold">
                <span className="flex items-center gap-2">
                  <span className="min-w-0">
                    <span dir="auto" className="block">
                      {localName(service, locale)}
                    </span>
                    <span dir="auto" className="block text-sm font-normal text-muted">
                      {locale === "ar" ? service.nameEn : service.nameAr}
                    </span>
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEditService(service)}
                      aria-label={t("editNamed", { name: localName(service, locale) })}
                      className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-sand hover:text-ink"
                    >
                      <Pencil className="size-4" aria-hidden="true" strokeWidth={2} />
                    </button>
                  )}
                </span>
              </th>
              {columns.flatMap((tier) =>
                bodies.map((body) => {
                  const price = cell(service, tier, body);
                  return (
                    <td key={`${tier?.id ?? "price"}-${body}`} className="border-s border-line p-1 text-center">
                      {price ? (
                        <PriceCell
                          price={price}
                          editable={canPrice}
                          label={t("priceOf", {
                            name: [localName(service, locale), tier && localName(tier, locale), body && t(`body.${body}`)].filter(Boolean).join(" · "),
                          })}
                        />
                      ) : (
                        <span className="text-muted" aria-hidden="true">
                          —
                        </span>
                      )}
                    </td>
                  );
                }),
              )}
              <td className="border-s border-line px-3 py-2 text-center">
                <Switch
                  checked={service.isActive}
                  disabled={!canEdit}
                  onCheckedChange={(checked) => void setActive(service, checked)}
                  aria-label={t("visibleNamed", { name: localName(service, locale) })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One price: a button that turns into a field. Enter or leaving the field saves, Escape gives up. */
function PriceCell({ price, editable, label }: { price: ServicePrice; editable: boolean; label: string }) {
  const t = useTranslations("Services");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const shown =
    price.price === null ? <span className="text-sm font-bold text-warning">{t("notSet")}</span> : formatMoney(price.price, locale, { whole: true });
  if (!editable) return <span className="block px-2 py-1.5 font-bold tabular-nums">{shown}</span>;

  const save = async () => {
    if (draft === null || saving) return;
    const value = normalizePrice(draft);
    if (value === "" || Number(value) === Number(price.price ?? NaN)) return setDraft(null);
    if (!PRICE_PATTERN.test(value)) return void toast.error(t("badPrice"));
    setSaving(true);
    try {
      // a service's price is a product's price: same permission, same history
      await api(`/products/${price.productId}/price`, { method: "PATCH", json: { price: value } });
      await queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      toast.success(t("priceSaved"));
      setDraft(null);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setSaving(false);
    }
  };

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(price.price === null ? "" : String(Number(price.price)))}
        aria-label={label}
        className="w-full rounded-md px-2 py-1.5 font-bold tabular-nums hover:bg-sand focus-visible:bg-sand"
      >
        {shown}
      </button>
    );
  }
  return (
    <input
      autoFocus
      inputMode="decimal"
      dir="ltr"
      value={draft}
      disabled={saving}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
      className="w-full min-w-20 rounded-md border-[1.5px] border-accent bg-surface px-2 py-1 text-center font-mono font-bold tabular-nums outline-none"
    />
  );
}
