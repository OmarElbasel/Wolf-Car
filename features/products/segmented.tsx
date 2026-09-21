"use client";

import { cn } from "@/lib/utils";

/** Compact filter switch (toggle buttons with aria-pressed), styled like the landing page's flat chips. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex min-h-11 max-w-full flex-wrap items-center gap-1 rounded-[var(--radius-brand)] bg-sand p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-9 rounded-[8px] border border-transparent px-3 text-sm font-bold whitespace-nowrap text-ink-2 transition-colors outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink",
              active && "border-line bg-surface text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
