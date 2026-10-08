import { TicketPercent } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Wrap } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Icon } from "@/components/Icon";
import { SubpageHeader } from "@/components/SubpageHeader";
import { CartSheet } from "@/features/catalog/cart-sheet";
import { ServiceCatalog } from "@/features/packages/service-catalog";
import { routing } from "@/i18n/routing";
import { formatMoney } from "@/lib/format";
import { BUNDLE_COUPON, BUNDLE_SERVICES } from "@/lib/packages";
import { fetchPublicServices } from "@/lib/public-catalog";
import { lowestPrice } from "@/lib/services";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolved = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolved, namespace: "Packages" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/**
 * Services and packages: PPF, tint, polish and paint, with the prices set in
 * the dashboard. Ordered like the parts catalogue: they go into the same
 * basket, which is sent to the Bin Omran branch on WhatsApp.
 */
export default async function PackagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  setRequestLocale(locale);
  const t = await getTranslations("Packages");
  const money = (n: number) => formatMoney(n, locale, { whole: true });
  const catalog = await fetchPublicServices();
  // the two most asked-for kinds get a shortcut with their starting price
  const jumps = (["ppfFull", "ppfPartial"] as const).flatMap((section) => {
    const price = lowestPrice((catalog?.services ?? []).filter((s) => s.section === section));
    return price === null ? [] : [{ href: `#${section}`, label: t(`section.${section}`), price }];
  });
  const perks = [
    { icon: <Icon name="truck" className="size-5" />, title: t("perkPickupTitle"), body: t("perkPickupBody") },
    { icon: <Icon name="card" className="size-5" />, title: t("perkPayTitle"), body: t("perkPayBody") },
    {
      icon: <TicketPercent className="size-5" aria-hidden="true" strokeWidth={1.8} />,
      title: t("perkCouponTitle", { amount: money(BUNDLE_COUPON) }),
      body: t("perkCouponBody"),
    },
  ];

  // keyed: it crosses to the client inside an object, where React treats it as a list item
  const includes = (
    <div key="includes" className="mt-3.5 grid gap-3.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="rounded-[var(--radius-brand-lg)] border border-line bg-surface p-5">
        <h3 className="mb-3.5 text-[17px] font-extrabold">{t("includesTitle")}</h3>
        <ol className="grid gap-2.5 sm:grid-cols-2">
          {BUNDLE_SERVICES.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-accent text-[15px] font-extrabold text-white tabular-nums"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="text-[15px] font-semibold">{t(`services.${s}`)}</span>
            </li>
          ))}
        </ol>
      </div>
      <ul className="grid gap-2.5">
        {perks.map((p) => (
          <li key={p.title} className="flex items-center gap-3 rounded-[var(--radius-brand-lg)] border border-line bg-surface px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-brand)] bg-sand text-accent-ink">{p.icon}</span>
            <span className="leading-snug">
              <b className="block text-[15px] font-extrabold">{p.title}</b>
              <small className="block text-[13px] text-muted">{p.body}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <SubpageHeader />
      <main id="main" className="bg-sand pt-6 pb-24 lg:pt-8">
        <Wrap>
          <section className="relative mb-10 grid overflow-hidden rounded-[var(--radius-brand-lg)] bg-charcoal text-white md:grid-cols-[1fr_42%]">
            <div className="relative z-10 p-5 md:p-9">
              <p className="text-sm font-bold text-[#FF9A62]">{t("label")}</p>
              <h1 className="mt-1.5 text-[clamp(26px,5vw,40px)] leading-[1.2] font-extrabold">{t("title")}</h1>
              <p className="mt-2 max-w-[440px] text-[15px] text-white/70">{t("body")}</p>
              <nav aria-label={t("jumpAria")} className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {jumps.map((j) => (
                  <a
                    key={j.href}
                    href={j.href}
                    className="flex min-h-[60px] flex-col justify-center rounded-[var(--radius-brand)] border border-white/15 bg-white/5 px-4 py-2 transition-colors hover:border-[#FF9A62]"
                  >
                    <b className="text-[15px]">{j.label}</b>
                    <small className="text-[13px] text-white/65 tabular-nums">{t("from", { price: money(j.price) })}</small>
                  </a>
                ))}
              </nav>
            </div>
            <div className="relative h-[130px] md:h-full">
              <Image
                src="/assets/van-rtl-45.webp"
                alt=""
                fill
                preload
                sizes="(min-width:768px) 480px, 100vw"
                className="object-contain object-bottom px-6 pb-4 md:object-center md:py-6"
              />
            </div>
          </section>

          {catalog === null || catalog.services.length === 0 ? (
            <p className="rounded-[var(--radius-brand-lg)] border border-dashed border-line px-6 py-12 text-center text-ink-2">{t("unavailable")}</p>
          ) : (
            <ServiceCatalog catalog={catalog} extras={{ ppfFull: includes }} />
          )}
        </Wrap>
      </main>
      <CartSheet />
      <Footer />
    </>
  );
}
