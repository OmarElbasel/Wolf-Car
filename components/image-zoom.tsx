"use client";

import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A product photo that opens large when pressed. The children are the photo as
 * the card draws it; the dialog shows `src` on white, as big as the screen
 * allows (catalogue photos are cut-outs on white, some only ~200 px wide).
 * With `showName` the full name is written under the photo, for cards that
 * cut a long name short; `open` lets something else (the name) open it too.
 */
export function ImageZoom({
  src,
  name,
  viewLabel,
  closeLabel,
  className,
  showName = false,
  open: openProp,
  onOpenChange,
  children,
}: {
  /** the largest rendition there is */
  src: string;
  name: string;
  /** "View Brake pads larger" */
  viewLabel: string;
  closeLabel: string;
  className?: string;
  showName?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [own, setOwn] = useState(false);
  const open = openProp ?? own;
  const setOpen = (next: boolean) => {
    setOwn(next);
    onOpenChange?.(next);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={viewLabel} className={cn("block cursor-zoom-in", className)}>
        {children}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} // sized here, not on the photo: the dialog is positioned from the screen's
          // middle, so a width left to its content shrinks to half the screen
          className="block size-[min(calc(100vw-2rem),calc(100dvh-2rem),640px)] max-w-none overflow-visible border-0 bg-transparent p-0 sm:max-w-none">
          <DialogTitle className="sr-only">{name}</DialogTitle>
          <div className="flex size-full flex-col overflow-hidden rounded-[var(--radius-brand-lg)] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- an API-served photo shown as is; also drawn on the kiosk, outside the site's image setup */}
            <img src={src} alt={name} draggable={false} className="block min-h-0 w-full flex-1 object-contain p-4 sm:p-6" />
            {showName && (
              <p dir="auto" aria-hidden="true" className="border-t border-[#e4e1db] px-4 py-3 text-center text-[15px] leading-snug font-bold text-charcoal">
                {name}
              </p>
            )}
          </div>
          <DialogClose className="absolute end-2.5 top-2.5 grid size-12 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80">
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">{closeLabel}</span>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}
