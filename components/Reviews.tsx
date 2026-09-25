import { Wrap } from "./Button";
import { ReviewsCarousel, type ReviewCard } from "./ReviewsCarousel";
import { getLocale, getTranslations } from "next-intl/server";
import { getBranchList } from "@/lib/branches";
import { GOOGLE_RATINGS, GOOGLE_REVIEWS } from "@/lib/content";

/**
 * Every review shown must be copied from the real Google listing — inventing
 * customer quotes is off limits. Until GOOGLE_REVIEWS is filled, the carousel
 * shows clearly labelled placeholders.
 */
export async function Reviews() {
  const t = await getTranslations("Reviews");
  const branchName = Object.fromEntries(
    getBranchList(await getLocale()).map((b) => [b.id, b.name]),
  );
  const reviews: ReviewCard[] = GOOGLE_REVIEWS.length
    ? GOOGLE_REVIEWS.map((r) => ({ ...r, place: branchName[r.branch] }))
    : [0, 1, 2].map(() => ({
        name: t("placeholderName"),
        text: t("placeholder"),
        rating: 5,
        place: "",
      }));

  return (
    <section aria-labelledby="rev-h" className="bg-sand py-14 lg:py-20">
      <Wrap>
        <div className="mb-10 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-5 block h-10 w-[2px] bg-accent"
          />
          <div className="text-sm font-bold text-accent-ink">{t("label")}</div>
          <h2
            id="rev-h"
            className="mt-1 text-[clamp(25px,5.6vw,36px)] leading-[1.3] font-extrabold"
          >
            {t("title")}
          </h2>
          <ul className="mt-3 flex list-none flex-wrap items-center justify-center gap-2.5">
            {GOOGLE_RATINGS.map((g) => (
              <li key={g.branch}>
                <a
                  href={g.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-surface px-4 text-[14px] text-muted transition-colors hover:border-accent"
                >
                  <b className="text-base text-ink">{g.rating}</b>
                  <span aria-hidden="true" className="text-accent">
                    ★
                  </span>
                  <span className="font-semibold text-ink-2">
                    {branchName[g.branch]}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <ReviewsCarousel reviews={reviews} />
      </Wrap>
    </section>
  );
}
