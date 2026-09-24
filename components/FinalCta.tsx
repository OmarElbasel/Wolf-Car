import { getTranslations } from "next-intl/server";
import { Wrap } from "./Button";

/** Closing line + the brand hashtag. Call / WhatsApp live in the header and sticky bar already. */
export async function FinalCta() {
  const t = await getTranslations("FinalCta");

  return (
    <section className="border-t border-line bg-sand py-16 lg:py-24">
      <Wrap className="text-center">
        <h2 className="text-[clamp(22px,4.6vw,30px)] leading-[1.3] font-bold text-ink-2">{t("title")}</h2>
        {/* hashtag is a real, fixed tag used on the live social accounts —
            intentionally not translated, same in both locales */}
        <div dir="rtl" className="mt-2 text-[clamp(38px,9vw,76px)] leading-[1.2] font-extrabold text-accent-ink">
          {t("hashtag")}
        </div>
      </Wrap>
    </section>
  );
}
