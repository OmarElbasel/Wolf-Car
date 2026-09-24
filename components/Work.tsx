import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink, SectionHead, Wrap } from "./Button";
import { Icon } from "./Icon";
import { WorkVideos } from "./WorkVideos";
import { SOCIAL, getWorkVideos } from "@/lib/content";

export async function Work() {
  const t = await getTranslations("Work");
  const videos = getWorkVideos(await getLocale());

  return (
    <section id="work" className="bg-charcoal py-14 text-white lg:py-20">
      <Wrap>
        <SectionHead
          tone="dark"
          label={t("label")}
          title={t("title")}
          body={t("body")}
        />
        <WorkVideos videos={videos}>
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
        </WorkVideos>
      </Wrap>
    </section>
  );
}
