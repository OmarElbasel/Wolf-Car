"use client";

import type { VariantInfo } from "@/lib/variants";
import { cn } from "@/lib/utils";

/** Colour (or size) chips of one product. `touch` gives kiosk-sized targets. */
export function VariantPicker<P extends VariantInfo & { id: string }>({
  variants,
  selected,
  onSelect,
  label,
  touch = false,
}: {
  variants: P[];
  selected: string;
  onSelect: (id: string) => void;
  /** accessible name of the group, e.g. "Colour" */
  label: string;
  touch?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {variants.map((v) => {
        const active = v.id === selected;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(v.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border-[1.5px] bg-surface font-semibold transition-colors",
              touch ? "min-h-11 px-3.5 text-[15px]" : "min-h-8 px-2.5 text-[13px]",
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
            <span dir="auto">{v.variantLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
