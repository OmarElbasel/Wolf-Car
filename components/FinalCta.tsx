import { getTranslations } from "next-intl/server";
import { Wrap } from "./Button";
import { CallButton, WhatsAppButton } from "./ContactButtons";

export async function FinalCta() {
  const t = await getTranslations("FinalCta");

  return (
    <section className="border-t border-line bg-sand py-14 lg:py-20">
      <Wrap className="grid items-center gap-[18px] md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-[clamp(25px,5.6vw,36px)] leading-[1.3] font-extrabold">
            {t("title")}
          </h2>
          {/* hashtag is a real, fixed tag used on the live social accounts —
              intentionally not translated, same in both locales */}
          <div dir="rtl" className="font-extrabold text-accent-ink">
            {t("hashtag")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <WhatsAppButton />
          <CallButton />
        </div>
      </Wrap>
    </section>
  );
}
