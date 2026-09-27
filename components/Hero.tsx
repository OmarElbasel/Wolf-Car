import { CreditCard, House, MapPin, Truck } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { CSSProperties, ReactNode } from "react";
import { Wrap } from "./Button";
import { HeroActions } from "./HeroActions";

/**
 * Cinematic booking hero: a light stage in light mode and a dark one in dark
 * mode, the van lit by an orange glow with a floor reflection, and the booking actions. The van sits
 * on the left in both languages because the photo is an angled shot facing
 * right, toward the text; flipping it would look wrong.
 *
 * On load it plays one short "arrival": the tracking card's route runs from the
 * branch to the house while the van drives in, then the headlights come on and
 * a showroom light sweeps the body (and again every few seconds). All of it is
 * CSS in globals.css; with reduced motion the hero renders the arrived state.
 */
export async function Hero() {
  const t = await getTranslations("Hero");
  const locale = await getLocale();

  const stats: { icon: ReactNode; value: string; label: string }[] = [
    { icon: <House className="size-5 text-accent dark:text-brand" aria-hidden="true" strokeWidth={1.8} />, value: t("homeValue"), label: t("homeLabel") },
    { icon: <MapPin className="size-5 text-accent dark:text-brand" aria-hidden="true" strokeWidth={1.8} />, value: t("branchesValue"), label: t("branchesLabel") },
    { icon: <Truck className="size-5 text-accent dark:text-brand" aria-hidden="true" strokeWidth={1.8} />, value: t("towValue"), label: t("towLabel") },
    { icon: <CreditCard className="size-5 text-accent dark:text-brand" aria-hidden="true" strokeWidth={1.8} />, value: t("payValue"), label: t("payLabel") },
  ];

  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-sand text-ink dark:bg-[#0b0a09] dark:text-white">
      {/* backdrop: faint grid, the orange glow behind the van, the outlined wordmark */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-grid absolute inset-0" />
        <div className="hero-glow absolute bottom-[8%] left-1/2 h-[60%] w-[120%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(242,112,42,0.38),transparent)] opacity-60 dark:opacity-100 lg:top-[22%] lg:bottom-auto lg:left-[-8%] lg:h-[78%] lg:w-[70%] lg:translate-x-0" />
        <span
          dir="ltr"
          className="hero-outline absolute top-[34%] left-1/2 -translate-x-1/2 text-[clamp(90px,17vw,250px)] leading-none font-extrabold tracking-[0.04em] whitespace-nowrap lg:top-[26%]"
        >
          WOLF CAR
        </span>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#ebe6de] to-transparent dark:from-black/70" />
      </div>

      <Wrap className="flex flex-col pt-[104px] pb-8 lg:min-h-[min(100svh,920px)] lg:pt-[124px] lg:pb-10">
        {/* dir="ltr" pins the van to the left; the text column keeps the page direction */}
        <div dir="ltr" className="grid flex-1 items-center gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
          <div dir={locale === "ar" ? "rtl" : "ltr"} className="hero-rise max-w-[600px] lg:justify-self-end">
            <p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3.5 py-1.5 text-[13px] font-bold text-ink-2 backdrop-blur-md dark:border-white/15 dark:bg-white/[0.06] dark:text-white/85">
              <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
              {t("eyebrow")}
            </p>
            <h1 id="hero-title" className="mt-5 text-[clamp(38px,5.2vw,62px)] leading-[1.14] font-extrabold tracking-[-0.01em]">
              {t.rich("title", { hl: (chunks) => <span className="whitespace-nowrap text-accent dark:text-brand">{chunks}</span> })}
            </h1>
            <p className="mt-4 max-w-[510px] text-[16px] leading-relaxed text-ink-2 lg:text-[17px] dark:text-white/70">{t("body")}</p>
            <HeroActions />
          </div>

          <div className="relative mx-auto w-full max-w-[640px] lg:order-first lg:max-w-none">
            <TrackCard dir={locale === "ar" ? "rtl" : "ltr"} label={t("homeValue")} title={t("trackTitle")} />
            <div className="hero-drive relative w-[112%] -translate-x-[6%] lg:w-[106%] lg:-translate-x-[5%]">
              {/* floor: a soft contact shadow and a faded mirror that takes no layout space */}
              <div aria-hidden="true" className="absolute bottom-[3%] left-[12%] h-[10%] w-[74%] rounded-[50%] bg-black/40 blur-xl dark:bg-black/80" />
              <Image
                src="/assets/van-rtl-45.webp"
                alt={t("vanAlt")}
                width={1502}
                height={813}
                preload
                sizes="(min-width:1024px) 680px, 100vw"
                className="relative z-10 h-auto w-full"
              />
              {/* headlights (near and far lamp), their pool on the floor, and the light sweep clipped to the van */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
                <span className="hero-lamp absolute top-[46%] left-[66.5%] aspect-[2/1] w-[15%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
                <span className="hero-lamp absolute top-[46.5%] left-[96.4%] aspect-[3/4] w-[5.5%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
                <span className="hero-beam absolute top-[84%] left-[70%] aspect-[3/1] w-[46%] rounded-full opacity-40 dark:opacity-100" />
                <span className="hero-sheen absolute inset-0" />
              </div>
              <Image
                src="/assets/van-rtl-45.webp"
                alt=""
                aria-hidden="true"
                width={1502}
                height={813}
                sizes="(min-width:1024px) 680px, 100vw"
                className="hero-reflection pointer-events-none absolute top-[96%] left-0 h-auto w-full -scale-y-100 opacity-15 dark:opacity-25"
              />
            </div>
          </div>
        </div>

        <ul
          aria-label={t("statsAria")}
          className="hero-rise relative z-10 mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line backdrop-blur-md lg:mt-6 lg:grid-cols-4 dark:border-white/10 dark:bg-white/10"
        >
          {stats.map((s) => (
            <li key={s.label} className="flex items-center gap-3 bg-white/90 px-4 py-3.5 lg:px-5 lg:py-4 dark:bg-[#0d0c0b]/75">
              <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-accent/10 dark:bg-white/[0.06]">{s.icon}</span>
              <span className="min-w-0 leading-snug">
                <b className="block text-[15px] font-extrabold tabular-nums lg:text-[17px]">{s.value}</b>
                <small className="block text-[12px] text-muted lg:text-[13px] dark:text-white/60">{s.label}</small>
              </span>
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  );
}

/** the mini route drawn in the tracking card: branch (bottom left) to house (top right) */
const ROUTE = "M6 31C26 33 36 9 60 12";

/**
 * Glass "tracking" card over the van: a dot travels the route from the branch
 * to the house and the house pin pings on arrival. Decorative; the same
 * message is in the stats row, so it is hidden from assistive tech.
 */
function TrackCard({ dir, label, title }: { dir: "rtl" | "ltr"; label: string; title: string }) {
  return (
    <div
      aria-hidden="true"
      dir={dir}
      className="hero-track absolute -top-[8%] right-[2%] z-30 flex items-center gap-3 rounded-[16px] border border-black/10 bg-white/80 py-2.5 ps-2.5 pe-4 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] backdrop-blur-md lg:-top-[15%] lg:right-[6%] dark:border-white/10 dark:bg-[#141210]/75"
    >
      <span dir="ltr" className="relative block h-10 w-[72px] shrink-0">
        <svg viewBox="0 0 72 40" width="72" height="40" fill="none" className="absolute inset-0 overflow-visible">
          <path d={ROUTE} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.5 4.5" className="text-black/25 dark:text-white/30" />
          <path d={ROUTE} pathLength={1} stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeDasharray="1" className="hero-route text-accent dark:text-brand" />
          <circle cx="6" cy="31" r="3.5" strokeWidth="2" className="fill-white stroke-accent dark:fill-[#141210] dark:stroke-brand" />
        </svg>
        <span className="hero-dot absolute top-0 left-0 size-2.5 rounded-full bg-accent shadow-[0_0_0_3px_rgba(242,112,42,0.25)] dark:bg-brand" style={{ offsetPath: `path("${ROUTE}")` } as CSSProperties} />
        <span className="absolute top-[12px] left-[60px] -translate-x-1/2 -translate-y-1/2">
          <span className="hero-ping absolute inset-0 rounded-full bg-accent/40 dark:bg-brand/40" />
          <span className="hero-house relative grid size-[22px] place-items-center rounded-full bg-accent text-white dark:bg-brand dark:text-black">
            <House className="size-3" strokeWidth={2.4} />
          </span>
        </span>
      </span>
      <span className="leading-tight">
        <small className="block text-[11px] font-bold tracking-wide text-muted uppercase dark:text-white/55">{label}</small>
        <b className="block text-[14px] font-extrabold whitespace-nowrap">{title}</b>
      </span>
    </div>
  );
}
