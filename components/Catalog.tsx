import { getLocale, getTranslations } from "next-intl/server";
import { SectionHead, Wrap } from "./Button";
import { Icon } from "./Icon";
import { AskLink, WhatsAppButton } from "./ContactButtons";
import { getCategories } from "@/lib/content";

export async function Catalog() {
  const locale = await getLocale();
  const t = await getTranslations("Catalog");
  const categories = getCategories(locale);

  return (
    <section id="catalog" className="bg-sand py-14 lg:py-20">
      <Wrap>
        <SectionHead label={t("label")} title={t("title")} body={t("body")} />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div
              key={c.title}
              className="rounded-[var(--radius-brand-lg)] border border-line bg-surface p-5"
            >
              <div className="mb-2.5 flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-[var(--radius-brand)] bg-sand text-accent-ink">
                  <Icon name={c.icon} className="size-[22px]" />
                </div>
                <h3 className="text-lg font-bold">{c.title}</h3>
              </div>
              <ul className="mb-1.5 grid list-none gap-1 text-[15px] text-ink-2">
                {c.items.map((i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="mt-0 size-[5px] flex-none -translate-y-[3px] rounded-full bg-[#BDB8B0] dark:bg-[#55524c]" />
                    {i}
                  </li>
                ))}
              </ul>
              <AskLink topic={c.topic}>{t("askAvailability")}</AskLink>
            </div>
          ))}
        </div>

        <div className="mt-7 grid items-center gap-3.5 rounded-[var(--radius-brand-lg)] border border-line bg-surface p-5 md:grid-cols-[auto_1fr_auto] md:px-[26px] md:py-[22px]">
          <div
            aria-label="PayLater"
            className="flex items-center gap-2 text-[22px] font-extrabold text-[#3F2A9E] dark:text-[#a996ff]"
          >
            {/* TODO: swap for the real PayLater logo file when it arrives */}
            <i className="inline-block size-[26px] rounded-[7px] bg-[linear-gradient(135deg,#6A4BE0_58%,#45CFCF_58%)]" />
            PayLater
          </div>
          <div>
            <h3 className="text-lg font-bold">{t("paylaterTitle")}</h3>
            <p className="text-[15px] text-ink-2">{t("paylaterBody")}</p>
          </div>
          <WhatsAppButton
            variant="outline"
            size="sm"
            label={t("paylaterCta")}
            message={t("paylaterMessage")}
          />
        </div>
      </Wrap>
    </section>
  );
}
