import { getLocale, getTranslations } from "next-intl/server";
import { SectionHead, Wrap, Photo } from "./Button";
import { Icon } from "./Icon";
import { AskLink } from "./ContactButtons";
import { getServices } from "@/lib/content";

export async function Services() {
  const locale = await getLocale();
  const t = await getTranslations("Services");
  const services = getServices(locale);

  return (
    <section id="services" className="py-14 lg:py-20">
      <Wrap>
        <SectionHead label={t("label")} title={t("title")} body={t("body")} />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <article
              key={s.title}
              className="overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface"
            >
              <div className="aspect-video">
                <Photo label={s.photoAlt} />
              </div>
              <div className="px-[18px] pt-4 pb-3.5">
                <h3 className="text-[19px] leading-[1.4] font-bold">{s.title}</h3>
                <p className="mt-1 mb-1.5 text-[15px] text-ink-2">{s.blurb}</p>
                {s.atHome && (
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                    <Icon name="home" className="size-4 text-accent-ink" />
                    {t("atHome")}
                  </div>
                )}
                {s.topic ? (
                  <AskLink topic={s.topic}>{s.linkLabel}</AskLink>
                ) : (
                  <a
                    href={s.href}
                    className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-accent-ink hover:underline hover:underline-offset-4"
                  >
                    {s.linkLabel}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
