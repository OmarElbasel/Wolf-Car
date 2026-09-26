import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { SectionHead, Wrap, buttonClass } from "./Button";
import { WhatsAppButton } from "./ContactButtons";
import { categoryName } from "@/features/catalog/category-name";
import { Link } from "@/i18n/navigation";
import { fetchPublicCategories } from "@/lib/public-catalog";

/** How many car models the landing page shows; the rest live on /products. */
const SHOWN = 6;

/**
 * Checkerboard of tones across the two-column grid: colored cards alternate
 * brand orange and charcoal, the others sit on the plain surface.
 */
const TONES = {
  accent: { card: "bg-accent text-white", sub: "text-white", dot: "bg-white text-accent" },
  dark: { card: "bg-charcoal text-white", sub: "text-white/55", dot: "bg-white text-charcoal" },
  plain: { card: "bg-surface text-ink border border-line", sub: "text-muted", dot: "bg-ink text-surface" },
} as const;

function toneFor(i: number): keyof typeof TONES {
  const colored = (Math.floor(i / 2) + (i % 2)) % 2 === 0;
  if (!colored) return "plain";
  return Math.floor(i / 2) % 2 === 0 ? "accent" : "dark";
}

export async function Catalog() {
  const t = await getTranslations("Catalog");
  const locale = await getLocale();
  const categories = await fetchPublicCategories();
  const shown = categories?.slice(0, SHOWN) ?? [];

  return (
    <section id="catalog" className="bg-sand py-14 lg:py-20">
      <Wrap>
        <SectionHead label={t("label")} title={t("title")} body={t("body")} />

        {shown.length > 0 && (
          <>
            <ul className="grid list-none grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
              {shown.map((c, i) => {
                const tone = TONES[toneFor(i)];
                return (
                  <li key={c.id}>
                    <Link
                      href={{ pathname: "/products", query: { category: c.id } }}
                      className={`group relative flex h-[210px] flex-col justify-between overflow-hidden rounded-[22px] p-6 md:h-[240px] md:p-8 ${tone.card}`}
                    >
                      <div className="relative z-10 max-w-[52%]">
                        <h3 className="text-[24px] [unicode-bidi:plaintext] ltr:text-left rtl:text-right leading-[1.25] font-extrabold md:text-[30px]">
                          {categoryName(c, locale)}
                        </h3>
                        <p className={`text-[20px] leading-[1.3] font-bold md:text-[26px] ${tone.sub}`}>
                          {t("itemCount", { count: c.count })}
                        </p>
                      </div>
                      <span className="relative z-10 inline-flex items-center gap-3 text-[15px] font-bold">
                        <span className={`grid size-9 place-items-center rounded-full ${tone.dot}`}>
                          <ArrowUpRight className="size-[18px] rtl:-scale-x-100" strokeWidth={2.2} aria-hidden="true" />
                        </span>
                        {t("showMore")}
                      </span>
                      {c.imageUrl && (
                        <div className="pointer-events-none absolute -end-5 bottom-4 h-[72%] w-[56%] transition-transform duration-500 group-hover:-translate-y-1.5 group-hover:scale-[1.03] md:-end-6">
                          <Image src={c.imageUrl} alt="" fill sizes="380px" unoptimized className="object-contain object-bottom" />
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {categories && categories.length > SHOWN && (
              <div className="mt-6 flex justify-center">
                <Link href="/products" className={buttonClass("outline")}>
                  {t("viewAll", { count: categories.length })}
                </Link>
              </div>
            )}
          </>
        )}

        <div className="relative mt-7 overflow-hidden rounded-[18px] bg-[linear-gradient(100deg,#15122a_0%,#3b1a6e_45%,#4a1f86_60%,#1c1636_100%)] px-4 py-4 text-white md:px-5 md:py-4">
          <div className="grid items-center gap-3.5 md:grid-cols-[auto_1fr_auto] md:gap-5">
            <div
              aria-label="PayLater"
              className="flex h-[52px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-brand)] bg-white px-4 text-[18px] font-extrabold text-[#3F2A9E] md:w-[124px]"
            >
              {/* TODO: swap for the real PayLater logo file when it arrives */}
              <i className="inline-block size-[18px] rounded-[5px] bg-[linear-gradient(135deg,#6A4BE0_58%,#45CFCF_58%)]" />
              PayLater
            </div>
            <div>
              <span className="inline-block rounded-full bg-white/12 px-2.5 py-0.5 text-xs font-semibold text-white/85">
                {t("paylaterTag")}
              </span>
              <h3 className="mt-1.5 text-[17px] leading-[1.5] font-extrabold md:text-[19px]">{t("paylaterTitle")}</h3>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center md:flex-col md:items-stretch lg:flex-row lg:items-center">
              <div className="rounded-[var(--radius-brand)] bg-white/10 px-3.5 py-1.5 text-center">
                <b className="block text-sm leading-snug">{t("paylaterInstant")}</b>
                <small className="block text-[11px] text-white/65">{t("paylaterInstantNote")}</small>
              </div>
              <WhatsAppButton size="sm" label={t("paylaterCta")} message={t("paylaterMessage")} />
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
