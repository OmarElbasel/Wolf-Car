"use client";

import type { VariantInfo } from "@/lib/variants";
import { cn } from "@/lib/utils";

/**
 * Colour (or size) chips of one product. `touch` gives kiosk-sized targets.
 * `compact` is one row that scrolls sideways, with a colour drawn as a dot and
 * only the picked one named: it sits over the photo of a catalogue card, so a
 * product with colours is exactly as tall as one without.
 */
export function VariantPicker<P extends VariantInfo & { id: string }>({
  variants,
  selected,
  onSelect,
  label,
  touch = false,
  compact = false,
}: {
  variants: P[];
  selected: string;
  onSelect: (id: string) => void;
  /** accessible name of the group, e.g. "Colour" */
  label: string;
  touch?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex gap-1.5", compact ? "max-w-full overflow-x-auto overscroll-x-contain rounded-full bg-white/90 p-1 [scrollbar-width:none]" : "flex-wrap")}
    >
      {variants.map((v) => {
        const active = v.id === selected;
        // a dot says the colour; its name is read out and shown once picked
        const dotOnly = compact && Boolean(v.variantColor) && !active;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={dotOnly ? (v.variantLabel ?? undefined) : undefined}
            title={dotOnly ? (v.variantLabel ?? undefined) : undefined}
            onClick={() => onSelect(v.id)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border-[1.5px] bg-surface font-semibold whitespace-nowrap transition-colors",
              touch ? "min-h-11 px-3.5 text-[15px]" : dotOnly ? "size-8 text-[13px]" : "min-h-8 px-2.5 text-[13px]",
              active ? "border-accent text-ink" : "border-line text-ink-2 hover:border-ink",
            )}
          >
            {v.variantColor && (
              <span
                aria-hidden="true"
                className={cn("shrink-0 rounded-full border border-black/15", touch ? "size-4" : "size-3.5")}
                style={{ backgroundColor: v.variantColor }}
              />
            )}
            {!dotOnly && <span dir="auto">{v.variantLabel}</span>}
          </button>
        );
      })}
    </div>
  );
}
