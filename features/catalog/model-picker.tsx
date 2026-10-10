"use client";

import { ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import { Direction } from "radix-ui";
import { useState } from "react";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface ModelChoice {
  key: string;
  href: "/products" | { pathname: "/products"; query: { category: string } };
  name: string;
  count: number;
  active: boolean;
}

/**
 * Every car model in one list, for phones: the chip row holds two dozen
 * models, and the one a visitor owns can be many swipes away.
 */
export function ModelPicker({ choices, label, closeLabel }: { choices: ModelChoice[]; label: string; closeLabel: string }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <Direction.Provider dir={locale === "ar" ? "rtl" : "ltr"}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border border-ink bg-surface px-4 text-[15px] font-bold whitespace-nowrap"
      >
        {label}
        <ChevronDown className="size-4" aria-hidden="true" strokeWidth={2.2} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" closeLabel={closeLabel} className="h-[80dvh] gap-0">
          <SheetHeader className="border-b border-line pb-4">
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>
          <SheetBody className="px-0">
            <ul className="divide-y divide-line">
              {choices.map((c) => (
                <li key={c.key}>
                  <Link
                    href={c.href}
                    onClick={() => setOpen(false)}
                    aria-current={c.active ? "page" : undefined}
                    className={cn("flex min-h-[52px] items-center justify-between gap-3 px-5 text-base font-bold", c.active && "bg-sand text-accent-ink")}
                  >
                    <span dir="auto" className="min-w-0 truncate">
                      {c.name}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-muted tabular-nums">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </Direction.Provider>
  );
}
