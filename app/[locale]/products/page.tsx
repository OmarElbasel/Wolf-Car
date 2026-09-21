import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Wrap, SectionHead } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CatalogGrid } from "@/features/catalog/catalog-grid";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LOGO } from "@/lib/content";
import { fetchPublicCatalog } from "@/lib/public-catalog";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolved = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolved, namespace: "ProductsPage" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** Public catalogue, reachable from the landing page footer. No prices or barcodes. */
export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  setRequestLocale(locale);
  const t = await getTranslations("ProductsPage");
  const header = await getTranslations("Header");
  const brand = await getTranslations("Brand");
  const products = await fetchPublicCatalog();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-surface">
        <Wrap className="flex h-[66px] items-center justify-between gap-3">
          <Link href="/" aria-label={header("logoAria")} className="flex items-center gap-2.5">
            <Image src={LOGO} alt="" width={40} height={40} className="size-10 object-contain" unoptimized />
            <span>
              <b className="block text-lg leading-tight font-extrabold">{brand("name")}</b>
              <small className="block text-[11px] leading-tight font-semibold tracking-[0.06em] text-muted">WOLF CAR</small>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/" className="hidden min-h-11 items-center px-2 text-sm font-bold text-ink-2 hover:text-ink sm:inline-flex">
              {t("backHome")}
            </Link>
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </Wrap>
      </header>
      <main id="main" className="bg-sand py-14 lg:py-20">
        <Wrap>
          <SectionHead label={t("label")} title={t("title")} body={t("body")} />
          {products === null ? (
            <p role="alert" className="rounded-[var(--radius-brand-lg)] border border-line bg-surface px-6 py-12 text-center text-ink-2">
              {t("unavailable")}
            </p>
          ) : (
            <CatalogGrid products={products} />
          )}
        </Wrap>
      </main>
      <Footer />
    </>
  );
}
