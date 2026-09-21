import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink, Photo, SectionHead, Wrap } from "./Button";
import { Icon } from "./Icon";
import { getBranchList, getHours, telLink, waLink } from "@/lib/branches";

export async function Branches() {
  const locale = await getLocale();
  const t = await getTranslations("Branches");
  const common = await getTranslations("Common");
  const branchList = getBranchList(locale);
  const hours = getHours(locale);

  return (
    <section id="branches" className="bg-sand py-14 lg:py-20">
      <Wrap>
        <SectionHead label={t("label")} title={t("title")} body={t("body")} />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {branchList.map((b) => (
            <article
              key={b.id}
              className="overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface"
            >
              <div className="aspect-video">
                <Photo label={b.photoAlt} />
              </div>
              <div className="px-5 pt-[18px] pb-5">
                <h3 className="text-[22px] font-extrabold">{b.name}</h3>
                <div className="mt-1.5 mb-4 grid gap-1 text-[15px] text-ink-2">
                  <div className="flex items-center gap-2">
                    <Icon name="pin" className="size-[18px] text-muted" />
                    {b.area}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="clock" className="size-[18px] text-muted" />
                    {hours}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ButtonLink
                    variant="outline"
                    href={telLink(locale, b.id)}
                    className="min-h-[46px] gap-1.5 px-1.5 text-[15px]"
                  >
                    <Icon name="phone" />
                    {common("call")}
                  </ButtonLink>
                  <ButtonLink
                    variant="outline"
                    href={waLink(locale, b.id)}
                    target="_blank"
                    rel="noopener"
                    className="min-h-[46px] gap-1.5 px-1.5 text-[15px]"
                  >
                    <Icon name="wa" className="size-5 text-wa" />
                    {common("whatsapp")}
                  </ButtonLink>
                  <ButtonLink
                    variant="outline"
                    href={b.maps}
                    target="_blank"
                    rel="noopener"
                    className="min-h-[46px] gap-1.5 px-1.5 text-[15px]"
                  >
                    <Icon name="nav" />
                    {common("mapLabel")}
                  </ButtonLink>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
