import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Wrap } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Icon } from "@/components/Icon";
import { SubpageHeader } from "@/components/SubpageHeader";
import { CartSheet } from "@/features/catalog/cart-sheet";
import { CatalogGrid } from "@/features/catalog/catalog-grid";
import { categoryName } from "@/features/catalog/category-name";
import { ModelSidebar, ModelTabs } from "@/features/catalog/model-tabs";
import { routing } from "@/i18n/routing";
import { fetchPublicCatalog, fetchPublicCategories } from "@/lib/public-catalog";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolved = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolved, namespace: "ProductsPage" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/**
 * Public catalogue, reachable from the landing page's car-model cards and
 * footer: prices and a basket that is sent to the Bin Omran branch on
 * WhatsApp (no barcodes, no online payment). ?category=<id> narrows it to one model.
 */
export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const { locale: raw } = await params;
  const { category: rawCategory } = await searchParams;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  setRequestLocale(locale);
  const t = await getTranslations("ProductsPage");
  const categories = (await fetchPublicCategories()) ?? [];
  // an unknown or stale id falls back to every product instead of an empty page
  const selected = categories.find((c) => c.id === rawCategory);
  const products = await fetchPublicCatalog(selected?.id);
  const perks = [
    { icon: "wa", title: t("perkOrderTitle"), body: t("perkOrderBody") },
    { icon: "wrench", title: t("perkFitTitle"), body: t("perkFitBody") },
    { icon: "card", title: t("perkPayTitle"), body: t("perkPayBody") },
  ] as const;

  return (
    <>
      <SubpageHeader />
      <main id="main" className="bg-sand pt-6 pb-24 lg:pt-8">
        <Wrap>
          {/* banner for the selected car model (the Wolf Car van for "all") */}
          <section className="relative mb-5 grid min-h-[190px] items-center overflow-hidden rounded-[var(--radius-brand-lg)] bg-charcoal text-white md:min-h-[230px] md:grid-cols-[1fr_46%]">
            <div className="relative z-10 p-5 pb-2 md:p-9">
              <p className="text-sm font-bold text-[#FF9A62]">{t("label")}</p>
              <h1 dir="auto" className="mt-1.5 text-start text-[clamp(26px,5vw,40px)] leading-[1.2] font-extrabold">
                {selected ? categoryName(selected, locale) : t("title")}
              </h1>
              <p className="mt-2 max-w-[440px] text-[15px] text-white/70">
                {selected ? t("modelBody", { count: selected.count }) : t("body")}
              </p>
            </div>
            <div className="relative h-[120px] md:h-full">
              <Image
                src={selected?.imageUrl ?? "/assets/van-rtl-45.webp"}
                alt=""
                fill
                preload
                sizes="(min-width:768px) 520px, 100vw"
                className="object-contain object-bottom px-6 pb-4 md:object-center md:py-6"
                unoptimized={Boolean(selected?.imageUrl)}
              />
            </div>
          </section>

          <ul className="mb-7 hidden gap-2.5 sm:grid sm:grid-cols-3">
            {perks.map((p) => (
              <li key={p.title} className="flex items-center gap-3 rounded-[var(--radius-brand-lg)] border border-line bg-surface px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-brand)] bg-sand text-accent-ink">
                  <Icon name={p.icon} className="size-5" />
                </span>
                <span className="leading-snug">
                  <b className="block text-[15px] font-extrabold">{p.title}</b>
                  <small className="block text-[13px] text-muted">{p.body}</small>
                </span>
              </li>
            ))}
          </ul>

          <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-7">
            <ModelSidebar categories={categories} selected={selected?.id} />
            <div>
              <ModelTabs categories={categories} selected={selected?.id} />
              {products === null ? (
                <p role="alert" className="rounded-[var(--radius-brand-lg)] border border-line bg-surface px-6 py-12 text-center text-ink-2">
                  {t("unavailable")}
                </p>
              ) : (
                <CatalogGrid key={selected?.id ?? "all"} products={products} />
              )}
            </div>
          </div>
        </Wrap>
      </main>
      <CartSheet />
      <Footer />
    </>
  );
}
