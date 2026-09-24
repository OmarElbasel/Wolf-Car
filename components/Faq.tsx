import { getLocale, getTranslations } from "next-intl/server";
import { SectionHead, Wrap } from "./Button";
import { Icon } from "./Icon";
import { getFaqs } from "@/lib/content";

export async function Faq() {
  const locale = await getLocale();
  const t = await getTranslations("Faq");
  const faqs = getFaqs(locale);

  return (
    <section id="faq" className="py-14 lg:py-20">
      <Wrap className="max-w-[860px]!">
        <SectionHead label={t("label")} title={t("title")} />
        {faqs.map((f) => (
          <details key={f.q} className="group border-b border-line">
            <summary className="flex min-h-[60px] cursor-pointer items-center justify-between gap-3 text-[17px] font-bold">
              {f.q}
              <Icon
                name="plus"
                className="size-5 text-muted transition-transform duration-200 group-open:rotate-45"
              />
            </summary>
            <p className="pb-4 text-ink-2">{f.a}</p>
          </details>
        ))}
      </Wrap>
    </section>
  );
}
