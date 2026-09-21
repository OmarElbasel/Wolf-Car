import { getLocale, getTranslations } from "next-intl/server";
import { SectionHead, Wrap } from "./Button";
import { getSteps } from "@/lib/content";

export async function Steps() {
  const locale = await getLocale();
  const t = await getTranslations("Steps");
  const steps = getSteps(locale);

  return (
    <section aria-labelledby="steps-h" className="py-14 lg:py-20">
      <Wrap>
        <SectionHead label={t("label")} title={t("title")} id="steps-h" />
        <div className="grid gap-0 md:grid-cols-3 md:gap-7">
          {steps.map((s) => (
            <div
              key={s.n}
              className="grid grid-cols-[44px_1fr] gap-3.5 border-t border-line py-[18px] md:grid-cols-1"
            >
              <div className="text-[28px] leading-none font-extrabold text-accent-ink">{s.n}</div>
              <div>
                <b className="text-lg font-bold">{s.title}</b>
                <p className="text-[15px] text-ink-2">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
