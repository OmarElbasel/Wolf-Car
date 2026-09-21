import { getTranslations } from "next-intl/server";
import { ButtonLink, Photo, SectionHead, Wrap } from "./Button";
import { Icon } from "./Icon";
import { SOCIAL } from "@/lib/content";

export async function Work() {
  const t = await getTranslations("Work");

  const TILES = [
    { label: t("tileTiktok"), tall: true },
    { label: t("tileBeforeAfter"), tall: false },
    { label: t("tileBeforeAfter"), tall: false },
    { label: t("tileInstagram"), tall: true },
    { label: t("tileBeforeAfter"), tall: false },
    { label: t("tileBeforeAfter"), tall: false },
  ];

  return (
    <section id="work" className="bg-charcoal py-14 text-white lg:py-20">
      <Wrap>
        <SectionHead tone="dark" label={t("label")} title={t("title")} body={t("body")} />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {TILES.map((tile, i) => (
            <div
              key={i}
              className={`overflow-hidden rounded-[var(--radius-brand)] ${
                tile.tall ? "row-span-2" : "aspect-square"
              }`}
            >
              <Photo label={tile.label} dark />
            </div>
          ))}
        </div>
        <div className="mt-[18px] flex flex-wrap gap-2.5">
          <ButtonLink
            variant="outline"
            size="sm"
            href={SOCIAL.tiktok}
            target="_blank"
            rel="noopener"
            className="!text-white !border-[#4A4A4A] hover:!border-white"
          >
            <Icon name="tt" />
            {t("tiktokLabel")}
          </ButtonLink>
          <ButtonLink
            variant="outline"
            size="sm"
            href={SOCIAL.instagram}
            target="_blank"
            rel="noopener"
            className="!text-white !border-[#4A4A4A] hover:!border-white"
          >
            <Icon name="ig" />
            {t("instagramLabel")}
          </ButtonLink>
        </div>
      </Wrap>
    </section>
  );
}
