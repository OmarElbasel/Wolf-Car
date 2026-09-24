import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { SectionHead, Wrap } from "./Button";
import { AskLink } from "./ContactButtons";
import { getServices } from "@/lib/content";

/**
 * Bento layout for five cards: a narrow + wide pair on top, three equal cards
 * below. On tablets the third card spans the full row.
 */
const SPANS = [
  "lg:col-span-5",
  "lg:col-span-7",
  "md:col-span-2 lg:col-span-4",
  "lg:col-span-4",
  "lg:col-span-4",
];

export async function Services() {
  const locale = await getLocale();
  const t = await getTranslations("Services");
  const services = getServices(locale);

  return (
    <section id="services" className="py-14 lg:py-20">
      <Wrap>
        <SectionHead label={t("label")} title={t("title")} body={t("body")} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
          {services.map((s, i) => (
            <article
              key={s.title}
              className={`group flex flex-col rounded-[22px] border border-line bg-sand p-3.5 ${SPANS[i] ?? "lg:col-span-4"}`}
            >
              <div className="relative h-[190px] overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface lg:h-[220px]">
                <Image
                  src={s.image}
                  alt={s.photoAlt}
                  fill
                  sizes="(min-width: 1024px) 640px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </div>
              <div className="flex flex-1 flex-col px-1.5 pt-5">
                <h3 className="text-[19px] leading-[1.4] font-bold">
                  {s.title}
                </h3>
                <p className="mt-1 mb-1.5 text-[15px] text-muted">{s.blurb}</p>
                <div className="mt-auto">
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
              </div>
            </article>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
