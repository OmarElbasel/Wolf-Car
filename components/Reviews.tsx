import { getTranslations } from "next-intl/server";
import { SectionHead, Wrap } from "./Button";

/**
 * Placeholders on purpose. Every review on this page must be copied from the
 * real Google listing — inventing customer quotes is off limits.
 */
export async function Reviews() {
  const t = await getTranslations("Reviews");

  return (
    <section aria-labelledby="rev-h" className="py-14 lg:py-20">
      <Wrap>
        <SectionHead label={t("label")} title={t("title")} id="rev-h" />
        <div className="mb-[18px] flex items-center gap-3.5">
          <div className="text-[44px] leading-none font-extrabold">4.9</div>
          <div>
            <div aria-hidden="true" className="tracking-[1px] text-[#D98E04]">
              ★★★★★
            </div>
            <small className="text-muted">{t("ratingMeta")}</small>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[var(--radius-brand-lg)] border border-dashed border-[#CFCBC4] dark:border-[#3a3733] p-[18px] text-[15px] text-muted"
            >
              {t("placeholder")}
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
