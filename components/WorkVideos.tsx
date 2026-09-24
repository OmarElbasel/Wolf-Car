"use client";

import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import type { WorkVideo } from "@/lib/content";

function playerUrl(v: WorkVideo) {
  return v.platform === "tiktok"
    ? `https://www.tiktok.com/player/v1/${v.id}?autoplay=1&description=0&music_info=0&rel=0`
    : `https://www.instagram.com/reel/${v.id}/embed/`;
}

/**
 * Swipeable row of TikTok / Instagram clips. Each tile is just a saved cover
 * until tapped — only then is the platform's player loaded, so the landing
 * page does not pull in six third-party players up front.
 */
export function WorkVideos({
  videos,
  children,
}: {
  videos: WorkVideo[];
  /** links shown beside the arrows */ children?: ReactNode;
}) {
  const t = useTranslations("Work");
  const [playing, setPlaying] = useState<string | null>(null);
  const track = useRef<HTMLUListElement>(null);

  function scroll(step: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({
      left: step * (rtl ? -1 : 1) * el.clientWidth * 0.8,
      behavior: "smooth",
    });
  }

  const arrow =
    "hidden size-11 place-items-center rounded-full border-[1.5px] border-[#4A4A4A] text-white transition-colors hover:border-white md:grid";

  return (
    <div>
      <ul
        ref={track}
        className="-mx-5 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] md:gap-4"
      >
        {videos.map((v) => (
          <li
            key={v.id}
            className="relative aspect-[9/16] w-[62%] flex-none snap-start overflow-hidden rounded-[var(--radius-brand-lg)] bg-[#262626] sm:w-[38%] md:w-[calc((100%-3*16px)/4)]"
          >
            {playing === v.id ? (
              <iframe
                src={playerUrl(v)}
                title={v.title}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                scrolling="no"
                className={`size-full border-0 ${v.platform === "instagram" ? "bg-white" : "bg-black"}`}
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(v.id)}
                aria-label={t("play", { title: v.title })}
                className="group block size-full text-start"
              >
                <Image
                  src={v.thumb}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 280px, 62vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0)_45%)]" />
                <span className="absolute start-3 top-3 grid size-9 place-items-center rounded-full bg-black/55 text-white">
                  <Icon
                    name={v.platform === "tiktok" ? "tt" : "ig"}
                    className="size-[18px]"
                  />
                </span>
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-14 place-items-center rounded-full bg-white/90 text-charcoal transition-transform duration-300 group-hover:scale-110">
                    <Play
                      className="ms-0.5 size-6 fill-current"
                      aria-hidden="true"
                    />
                  </span>
                </span>
                <span className="absolute inset-x-3 bottom-3 text-[15px] leading-snug font-bold text-white">
                  {v.title}
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-[18px] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap gap-2.5">{children}</div>
        {videos.length > 4 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label={t("prev")}
              className={arrow}
            >
              <ChevronLeft
                className="size-5 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label={t("next")}
              className={arrow}
            >
              <ChevronRight
                className="size-5 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
