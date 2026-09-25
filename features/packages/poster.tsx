"use client";

import { Maximize2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Poster } from "@/lib/packages";
import { cn } from "@/lib/utils";

/**
 * A package poster that opens full size, so its small print is readable on a
 * phone. The expand and close buttons sit top-right in both languages: the
 * posters' top-left corner holds the film's flag.
 */
export function PosterButton({ poster, name, sizes, className }: { poster: Poster; name: string; sizes: string; className?: string }) {
  const t = useTranslations("Packages");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("viewPoster", { name })}
        className={cn("group relative block w-full overflow-hidden bg-white", className)}
      >
        <Image
          src={poster.src}
          alt=""
          width={poster.width}
          height={poster.height}
          sizes={sizes}
          className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <span
          aria-hidden="true"
          className="absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-black/55 text-white transition-colors group-hover:bg-black/75"
        >
          <Maximize2 className="size-4" strokeWidth={2.2} />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="w-auto max-w-none gap-0 overflow-visible border-0 bg-transparent p-0 sm:max-w-none">
          <DialogTitle className="sr-only">{name}</DialogTitle>
          <Image
            src={poster.src}
            alt={name}
            width={poster.width}
            height={poster.height}
            sizes="(min-width: 640px) 500px, 100vw"
            className="block h-auto max-h-[calc(100dvh-2rem)] w-auto max-w-[calc(100vw-2rem)] rounded-[var(--radius-brand-lg)]"
          />
          <DialogClose className="absolute top-2.5 right-2.5 grid size-10 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80">
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">{t("close")}</span>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}
