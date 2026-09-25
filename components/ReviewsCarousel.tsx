"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
export interface ReviewCard {
  name: string;
  text: string;
  rating: number;
  /** e.g. the branch name */
  place: string;
}

function Stars({ rating, size }: { rating: number; size: string }) {
  const t = useTranslations("Reviews");
  return (
    <div
      role="img"
      aria-label={t("stars", { rating })}
      className={`tracking-[2px] ${size}`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={n <= rating ? "text-accent" : "text-line"}
        >
          ★
        </span>
      ))}
    </div>
  );
}

/**
 * One review in focus, its neighbours faded at the sides (desktop only).
 * Arrows wrap around, so the row never runs out.
 */
export function ReviewsCarousel({ reviews }: { reviews: ReviewCard[] }) {
  const t = useTranslations("Reviews");
  const [index, setIndex] = useState(0);
  const count = reviews.length;
  const at = (offset: number) => reviews[(index + offset + count) % count];
  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  const arrow =
    "grid size-11 flex-none place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface hover:text-ink";
  const side =
    "hidden h-[190px] w-[250px] flex-none flex-col justify-center rounded-[var(--radius-brand-lg)] bg-surface/70 px-6 py-7 text-center text-[13px] leading-relaxed text-muted lg:flex";

  const prev = at(-1);
  const current = at(0);
  const next = at(1);

  return (
    <div className="flex items-center justify-center gap-2 md:gap-5">
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label={t("prev")}
        className={arrow}
        disabled={count < 2}
      >
        <ChevronLeft className="size-6 rtl:-scale-x-100" aria-hidden="true" />
      </button>

      {count > 2 && (
        <div aria-hidden="true" className={side}>
          <p dir="auto" className="line-clamp-4">
            &ldquo;{prev.text}&rdquo;
          </p>
          <p className="mt-4 truncate font-semibold">{prev.name}</p>
        </div>
      )}

      <figure
        aria-live="polite"
        className="relative flex h-[340px] w-full max-w-[440px] flex-col items-center rounded-[var(--radius-brand-lg)] bg-surface px-7 pt-9 pb-12 text-center shadow-[0_10px_30px_-18px_rgba(0,0,0,0.25)] md:px-10"
      >
        <Stars rating={current.rating} size="text-[26px]" />
        <blockquote
          dir="auto"
          className="mt-4 line-clamp-4 shrink-0 text-[16px] leading-[1.8] text-ink-2 md:text-[17px]"
        >
          &ldquo;{current.text}&rdquo;
        </blockquote>
        <figcaption className="mt-auto pt-5">
          <b className="block">{current.name}</b>
          <small className="text-[13px] text-muted">{current.place}</small>
        </figcaption>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -end-2 -bottom-10 font-serif text-[96px] md:-end-3 md:-bottom-9 md:text-[120px] leading-none font-black text-accent select-none"
        >
          &rdquo;
        </span>
      </figure>

      {count > 1 && (
        <div aria-hidden="true" className={side}>
          <p dir="auto" className="line-clamp-4">
            &ldquo;{next.text}&rdquo;
          </p>
          <p className="mt-4 truncate font-semibold">{next.name}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => go(1)}
        aria-label={t("next")}
        className={arrow}
        disabled={count < 2}
      >
        <ChevronRight className="size-6 rtl:-scale-x-100" aria-hidden="true" />
      </button>
    </div>
  );
}
