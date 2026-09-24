import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Wrap } from "./Button";
import { HeroActions } from "./HeroActions";
import { Icon } from "./Icon";

/** Booking-first hero: the page exists mostly to get people booked. */
export async function Hero() {
  const t = await getTranslations("Hero");

  return (
    <div id="top" className="hero-stage relative isolate overflow-hidden border-b border-line">
      {/* giant ghost wordmark — sits behind the van. Layout stays fixed (not
          mirrored) in both languages because the van photo is a directional
          RTL-angle shot; flipping it would look wrong. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[19%] z-0 text-center select-none lg:top-[30%] lg:bottom-auto lg:pe-[2vw] lg:text-right"
      >
        <span className="inline-block text-[clamp(60px,14vw,196px)] leading-[0.78] font-extrabold tracking-[0.06em] text-white opacity-[0.62] ltr:whitespace-nowrap" dir="ltr">
          WOLF CAR
        </span>
      </div>

      <Wrap className="hero-min-h relative z-20 pt-8 lg:flex lg:items-center lg:py-12">
        <div className="max-w-[520px] lg:mr-0 lg:ml-auto lg:w-[460px]">
          <div className="border-s-[3px] border-brand ps-3 text-sm font-bold tracking-[0.02em] text-accent-dark dark:text-accent-ink">
            {t("eyebrow")}
          </div>

          <h1 className="mt-4 mb-3 text-[clamp(32px,6.4vw,50px)] leading-[1.15] font-extrabold">{t("title")}</h1>

          <p className="text-[16px] leading-relaxed text-ink-2 lg:text-[17px]">{t("body")}</p>

          <HeroActions />

          <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-muted">
            <Icon name="clock" className="size-4" />
            {t("hours")}
          </p>
        </div>
      </Wrap>

      {/* van: in flow on mobile, absolutely placed on desktop */}
      <Image
        src="/assets/van-rtl-45.webp"
        alt={t("vanAlt")}
        width={1502}
        height={813}
        preload
        sizes="(min-width:1024px) 54vw, 108vw"
        className="hero-van-cap relative z-10 mt-2 block h-auto w-[108%] max-w-none -ml-[8%] lg:absolute lg:bottom-[12%] lg:left-[-3%] lg:m-0 lg:w-[54%]"
      />
    </div>
  );
}
