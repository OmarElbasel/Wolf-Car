import { Globe, House, ScanLine, Users } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import type { ReactNode } from "react";
import { buttonClass, SectionHead, Wrap } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { SubpageHeader } from "@/components/SubpageHeader";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Figures from the Wolf Group company profile (wolf-groups.com). The group
 * lists 3 branches, but this site only speaks for Wolf Car's two, so the branch
 * count is left out here on purpose.
 */
const GROUP_STATS = [
  { value: "+50,000", key: "groupCustomers" },
  { value: "4", key: "groupCompanies" },
  { value: "+100", key: "groupTeam" },
  { value: "3,000 m²", key: "groupWarehouse" },
] as const;

/** Logos cut from the group profile; swap for the original files when they arrive. */
const COMPANIES = [
  { name: "Wolf Car", logo: "/assets/group/car.webp", w: 135, h: 193, key: "companyCar" },
  { name: "Wolf Car Service", logo: "/assets/group/service.webp", w: 136, h: 194, key: "companyService" },
  { name: "Wolf Store", logo: "/assets/group/store.webp", w: 135, h: 194, key: "companyStore" },
  { name: "Octa Car Care", logo: "/assets/group/octa.webp", w: 221, h: 45, key: "companyOcta" },
] as const;

/** Real workshop shots (covers of our own TikTok / Instagram clips). */
const GALLERY = [
  "/assets/work/tt-7685463028988497172.webp",
  "/assets/work/ig-DbliRNpMWUP.webp",
  "/assets/work/ig-Db52PjhNUTI.webp",
  "/assets/work/ig-DcbHWGTN-Yu.webp",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolved = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;
  const t = await getTranslations({ locale: resolved, namespace: "About" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  setRequestLocale(locale);
  const t = await getTranslations("About");
  const cta = await getTranslations("FinalCta");

  const stats = [
    { value: "2", label: t("statBranches"), note: t("statBranchesNote") },
    { value: "5", label: t("statBrands"), note: t("statBrandsNote") },
    { value: "+1,200", label: t("statProducts"), note: t("statProductsNote") },
    { value: t("statTowValue"), label: t("statTow"), note: t("statTowNote") },
  ];

  const icon = "size-6 text-brand";
  const why: { icon: ReactNode; title: string; body: string }[] = [
    { icon: <Globe className={icon} aria-hidden="true" strokeWidth={1.8} />, title: t("whySupplyTitle"), body: t("whySupplyBody") },
    { icon: <ScanLine className={icon} aria-hidden="true" strokeWidth={1.8} />, title: t("whyToolsTitle"), body: t("whyToolsBody") },
    { icon: <Users className={icon} aria-hidden="true" strokeWidth={1.8} />, title: t("whyTeamTitle"), body: t("whyTeamBody") },
    { icon: <House className={icon} aria-hidden="true" strokeWidth={1.8} />, title: t("whyHomeTitle"), body: t("whyHomeBody") },
  ];

  const partners = [
    { name: "PayLater", logo: "/assets/group/paylater.webp", w: 600, h: 136, note: t("partnerPayLater") },
    { name: "Thabt", logo: "/assets/group/thabt.webp", w: 214, h: 81, note: t("partnerThabt") },
    { name: t("partnerImtiaz"), note: t("partnerImtiazNote") },
    { name: t("partnerTistahel"), note: t("partnerTistahelNote") },
  ];

  return (
    <>
      <SubpageHeader />
      <main id="main">
        {/* story: the same dark stage as the home hero, with both real storefronts */}
        <section className="relative isolate overflow-hidden bg-[#0b0a09] py-14 text-white lg:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="hero-grid absolute inset-0 [--grid-line:rgb(255_255_255/0.04)]" />
            <div className="absolute top-[10%] right-[-10%] h-[80%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgba(242,112,42,0.22),transparent)]" />
          </div>
          <Wrap>
            <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
              <div className="max-w-[600px]">
                <div className="text-sm font-bold text-[#FF9A62]">{t("label")}</div>
                <h1 className="mt-2 text-[clamp(30px,5.4vw,50px)] leading-[1.2] font-extrabold">
                  {t("title")}
                </h1>
                <p className="mt-5 text-[17px] leading-relaxed text-white/75">{t("story1")}</p>
                <p className="mt-3 text-[17px] leading-relaxed text-white/75">{t("story2")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-brand-lg)]">
                  <Image
                    src="/assets/branches/binomran-night.webp"
                    alt={t("photoBinOmran")}
                    fill
                    preload
                    sizes="(min-width:1024px) 260px, 50vw"
                    className="object-cover"
                  />
                </div>
                <div className="relative mt-10 aspect-[3/4] overflow-hidden rounded-[var(--radius-brand-lg)]">
                  <Image
                    src="/assets/branches/gharrafa.webp"
                    alt={t("photoGharrafa")}
                    fill
                    sizes="(min-width:1024px) 260px, 50vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

            <dl
              aria-label={t("statsAria")}
              className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-white/10 bg-white/10 lg:grid-cols-4"
            >
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col-reverse justify-end bg-[#0d0c0b] px-5 py-4">
                  <dt className="leading-snug">
                    <b className="block font-bold">{s.label}</b>
                    <small className="block text-[13px] text-white/60">{s.note}</small>
                  </dt>
                  <dd dir="ltr" className="text-start text-[28px] leading-tight font-extrabold text-brand tabular-nums rtl:text-end">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Wrap>
        </section>

        <section className="py-14 lg:py-20">
          <Wrap>
            <SectionHead label={t("whyLabel")} title={t("whyTitle")} />
            <ul className="grid list-none grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {why.map((w) => (
                <li key={w.title} className="rounded-[var(--radius-brand-lg)] border border-line bg-surface p-5">
                  <span className="grid size-11 place-items-center rounded-[12px] bg-brand/10">{w.icon}</span>
                  <h3 className="mt-4 font-bold">{w.title}</h3>
                  <p className="mt-1 text-sm text-muted">{w.body}</p>
                </li>
              ))}
            </ul>
          </Wrap>
        </section>

        <section className="bg-charcoal py-14 text-white lg:py-20">
          <Wrap>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Image
                src="/assets/group/group.webp"
                alt={t("groupLogoAlt")}
                width={440}
                height={361}
                sizes="120px"
                className="h-auto w-[120px] shrink-0"
              />
              <SectionHead tone="dark" label={t("groupLabel")} title={t("groupTitle")} body={t("groupBody")} />
            </div>

            <dl
              aria-label={t("groupStatsAria")}
              className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-white/10 bg-white/10 lg:grid-cols-4"
            >
              {GROUP_STATS.map((s) => (
                <div key={s.key} className="flex flex-col-reverse justify-end bg-charcoal px-5 py-4">
                  <dt className="text-[14px] text-white/65">{t(s.key)}</dt>
                  <dd dir="ltr" className="text-start text-[26px] leading-tight font-extrabold tabular-nums rtl:text-end">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-12 mb-4 text-xl font-extrabold">{t("companiesTitle")}</h3>
            <ul className="grid list-none grid-cols-2 gap-3.5 lg:grid-cols-4">
              {COMPANIES.map((c) => (
                <li
                  key={c.name}
                  className="flex flex-col items-center rounded-[var(--radius-brand-lg)] border border-white/10 bg-white/[0.03] p-5 text-center"
                >
                  <div className="grid h-[104px] w-full place-items-center">
                    <Image
                      src={c.logo}
                      alt={c.name}
                      width={c.w}
                      height={c.h}
                      sizes="140px"
                      className="max-h-[96px] w-auto max-w-[80%] object-contain"
                    />
                  </div>
                  <p className="mt-3 text-sm text-white/70">{t(c.key)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-white/60">{t("branchesNote")}</p>

            <div className="mt-12 grid gap-3.5 md:grid-cols-2">
              {(["vision", "mission"] as const).map((k) => (
                <div key={k} className="border-s-2 border-brand ps-5">
                  <h3 className="text-lg font-extrabold">{t(`${k}Title`)}</h3>
                  <p className="mt-1.5 leading-relaxed text-white/70">{t(`${k}Body`)}</p>
                </div>
              ))}
            </div>
          </Wrap>
        </section>

        <section className="bg-sand py-14 lg:py-20">
          <Wrap>
            <SectionHead label={t("partnersLabel")} title={t("partnersTitle")} body={t("partnersBody")} />
            <ul className="grid list-none grid-cols-2 gap-3.5 lg:grid-cols-4">
              {partners.map((p) => (
                <li key={p.name} className="overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface">
                  {/* logos are made for white, so the tile stays white in dark mode too */}
                  <div className="grid aspect-[5/2] place-items-center bg-white px-6">
                    {p.logo ? (
                      <Image src={p.logo} alt={p.name} width={p.w} height={p.h} sizes="200px" className="max-h-[56px] w-auto object-contain" />
                    ) : (
                      <span className="text-[26px] font-extrabold text-[#1a1a1a]">{p.name}</span>
                    )}
                  </div>
                  <p className="p-4 text-sm text-muted">{p.note}</p>
                </li>
              ))}
            </ul>
          </Wrap>
        </section>

        <section className="bg-charcoal py-14 text-white lg:py-20">
          <Wrap>
            <SectionHead
              tone="dark"
              label={t("galleryLabel")}
              title={t("galleryTitle")}
            />
            <ul className="grid list-none grid-cols-2 gap-3 lg:grid-cols-4">
              {GALLERY.map((src) => (
                <li
                  key={src}
                  className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-brand-lg)]"
                >
                  <Image
                    src={src}
                    alt={t("galleryAlt")}
                    fill
                    sizes="(min-width:1024px) 280px, 50vw"
                    className="object-cover"
                  />
                </li>
              ))}
            </ul>
          </Wrap>
        </section>

        <section className="py-14 lg:py-20">
          <Wrap className="text-center">
            <h2 className="text-[clamp(25px,5.6vw,36px)] leading-[1.3] font-extrabold">
              {t("ctaTitle")}
            </h2>
            {/* the live brand hashtag, same in both locales (see FinalCta) */}
            <div dir="rtl" className="mt-1 text-[clamp(26px,6vw,44px)] leading-[1.25] font-extrabold text-accent-ink">
              {cta("hashtag")}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <Link href="/#book" className={buttonClass("primary")}>
                {t("ctaBook")}
              </Link>
              <Link href="/#branches" className={buttonClass("outline")}>
                {t("ctaBranches")}
              </Link>
            </div>
          </Wrap>
        </section>
      </main>
      <Footer />
    </>
  );
}
