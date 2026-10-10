"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * On phones a stack of filter fields fills the first screen and pushes the
 * list out of sight, so the fields sit behind one button that says how many
 * are in use. From md up the button is gone and the fields are always there.
 */
export function PhoneFilters({ label, active, className, children }: { label: string; active: number; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <Button variant="outline" className="w-full justify-between md:hidden" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal aria-hidden="true" strokeWidth={1.8} />
          {label}
          {active > 0 && (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-extrabold text-white tabular-nums">{active}</span>
          )}
        </span>
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
      </Button>
      <div id={id} className={cn(className, !open && "max-md:hidden")}>
        {children}
      </div>
    </>
  );
}
