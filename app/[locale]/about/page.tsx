import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { buttonClass, Photo, SectionHead, Wrap } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { SubpageHeader } from "@/components/SubpageHeader";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { GOOGLE_RATINGS, getServices } from "@/lib/content";

/** TODO: replace with the real group / partner logo files. */
const GROUP_LOGOS = 6;
/** TODO: replace with real team members { name, role, photo }. */
const TEAM = 4;
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
  const services = getServices(locale);

  const stats = [
    { value: "2", label: t("statBranches"), note: t("statBranchesNote") },
    {
      value: GOOGLE_RATINGS.map((g) => g.rating).join(" · "),
      label: t("statRating"),
      note: "★★★★★",
    },
    {
      value: t("statHomeValue"),
      label: t("statHome"),
      note: t("statHomeNote"),
    },
    { value: "XPEL", label: t("statXpel"), note: t("statXpelNote") },
  ];

  return (
    <>
      <SubpageHeader />
      <main id="main">
        <section className="bg-sand py-14 lg:py-20">
          <Wrap>
            <div className="max-w-[720px]">
              <div className="text-sm font-bold text-accent-ink">
                {t("label")}
              </div>
              <h1 className="mt-1 text-[clamp(30px,6vw,48px)] leading-[1.2] font-extrabold">
                {t("title")}
              </h1>
              <p className="mt-4 text-lg text-ink-2">{t("body")}</p>
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-[var(--radius-brand-lg)] border border-line bg-surface p-5"
                >
                  <dd className="text-[28px] leading-tight font-extrabold text-accent-ink">
                    {s.value}
                  </dd>
                  <dt className="mt-1 font-bold">{s.label}</dt>
                  <dd className="text-sm text-muted">{s.note}</dd>
                </div>
              ))}
            </dl>
          </Wrap>
        </section>

        <section className="py-14 lg:py-20">
          <Wrap>
            <SectionHead label={t("label")} title={t("servicesTitle")} />
            <ul className="grid list-none grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
              {services.map((s) => (
                <li
                  key={s.title}
                  className="overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface"
                >
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={s.image}
                      alt={s.photoAlt}
                      fill
                      sizes="(min-width:1024px) 220px, 50vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted">{s.blurb}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Wrap>
        </section>

        <section className="bg-sand py-14 lg:py-20">
          <Wrap>
            <SectionHead
              label={t("groupLabel")}
              title={t("groupTitle")}
              body={t("groupBody")}
            />
            <ul className="grid list-none grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: GROUP_LOGOS }, (_, i) => (
                <li
                  key={i}
                  className="grid aspect-[3/2] place-items-center rounded-[var(--radius-brand-lg)] border border-dashed border-[#CFCBC4] bg-surface text-center text-sm font-semibold text-muted dark:border-[#3a3733]"
                >
                  {t("logoPlaceholder")}
                </li>
              ))}
            </ul>
          </Wrap>
        </section>

        <section className="py-14 lg:py-20">
          <Wrap>
            <SectionHead
              label={t("teamLabel")}
              title={t("teamTitle")}
              body={t("teamBody")}
            />
            <ul className="grid list-none grid-cols-2 gap-3.5 lg:grid-cols-4">
              {Array.from({ length: TEAM }, (_, i) => (
                <li
                  key={i}
                  className="overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface"
                >
                  <div className="aspect-[4/5]">
                    <Photo label={t("teamPhoto")} />
                  </div>
                  <div className="p-4">
                    <b className="block">{t("teamName")}</b>
                    <small className="text-muted">{t("teamRole")}</small>
                  </div>
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
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
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
