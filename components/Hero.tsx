import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink, Wrap } from "./Button";
import { WhatsAppButton } from "./ContactButtons";
import { getHeroFacts } from "@/lib/content";

export async function Hero() {
  const locale = await getLocale();
  const t = await getTranslations("Hero");
  const heroFacts = getHeroFacts(locale);

  return (
    <div
      id="top"
      className="hero-stage relative isolate overflow-hidden border-b border-line"
    >
      {/* giant ghost wordmark — sits behind the van. Layout stays fixed (not
          mirrored) in both languages because the van photo is a directional
          RTL-angle shot; flipping it would look wrong. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[19%] z-0 text-center select-none lg:top-[33%] lg:bottom-auto lg:pe-[2vw] lg:text-right"
      >
        <span className="inline-block text-[clamp(60px,14vw,196px)] leading-[0.78] font-extrabold tracking-[0.06em] text-white opacity-[0.62] ltr:whitespace-nowrap" dir="ltr">
          WOLF CAR
        </span>
      </div>

      <Wrap className="hero-min-h relative z-20 pt-9 lg:flex lg:items-center lg:py-14">
        <div className="ml-auto max-w-[560px] text-right lg:max-w-[470px]">
          <div className="border-r-[3px] border-brand pr-3 text-sm font-bold tracking-[0.02em] text-accent-dark">
            {t("eyebrow")}
          </div>

          <h1 className="mt-4 mb-3.5 text-[clamp(30px,6.4vw,48px)] leading-[1.22] font-extrabold">
            {t("title")}
          </h1>

          <p className="max-w-[540px] text-[17px] text-ink-2">{t("body")}</p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <WhatsAppButton />
            <ButtonLink variant="outline" href="#services">
              {t("servicesCta")}
            </ButtonLink>
          </div>

          <div className="relative z-20 mt-4 grid grid-cols-2 gap-y-3.5 border-t border-line pt-4 pb-3">
            {heroFacts.map((f, i) => (
              <div
                key={f.b}
                className={
                  i % 2 === 1
                    ? "border-s border-line ps-4"
                    : "pe-3.5"
                }
              >
                <b className="block text-base leading-[1.35] font-extrabold">{f.b}</b>
                <small className="text-[13px] text-[#5E5E5E] dark:text-[#a19b90]">{f.s}</small>
              </div>
            ))}
          </div>
        </div>
      </Wrap>

      {/* van: in flow on mobile, absolutely placed on desktop */}
      <Image
        src="/assets/van-rtl-45.webp"
        alt={t("vanAlt")}
        width={1502}
        height={813}
        priority
        sizes="(min-width:1024px) 54vw, 108vw"
        className="hero-van-cap relative z-10 mt-1 block h-auto w-[108%] max-w-none -ml-[8%] lg:absolute lg:bottom-[15%] lg:left-[-3%] lg:m-0 lg:w-[54%]"
      />
    </div>
  );
}
