"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { RoleBadge } from "@/components/app/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/states";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Product } from "@/lib/api/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { isolate } from "./bidi";
import { fetchPriceHistory, productKeys } from "./queries";

function History({ product }: { product: Product }) {
  const t = useTranslations("Products.price");
  const locale = useLocale();
  const history = useQuery({ queryKey: productKeys.history(product.id), queryFn: () => fetchPriceHistory(product.id) });

  if (history.isPending) return <LoadingRows rows={3} className="h-16" />;
  if (history.isError) return <ErrorState error={history.error} onRetry={() => void history.refetch()} />;
  if (history.data.length === 0) return <EmptyState title={t("historyEmpty")} />;

  return (
    <ol className="grid gap-2">
      {history.data.map((entry) => (
        <li key={entry.id} className="grid gap-1.5 rounded-[var(--radius-brand)] border border-line p-3">
          <p className="font-extrabold tabular-nums">
            {entry.oldPrice === null
              ? t("firstPrice", { new: isolate(formatMoney(entry.newPrice, locale)) })
              : t("from", { old: isolate(formatMoney(entry.oldPrice, locale)), new: isolate(formatMoney(entry.newPrice, locale)) })}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
            <span dir="auto" className="font-bold text-ink">
              {entry.changedBy.displayName}
            </span>
            <RoleBadge role={entry.changedBy.role} />
            <time dateTime={entry.changedAt} className="text-muted">
              {formatDateTime(entry.changedAt, locale)}
            </time>
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Newest-first list of every price change of one product. */
export function PriceHistorySheet({ open, product, onOpenChange }: { open: boolean; product: Product | null; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("Products.price");
  const tc = useTranslations("Common");
  const locale = useLocale();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={tc("close")}>
        <SheetHeader>
          <SheetTitle>{t("history")}</SheetTitle>
          <SheetDescription>
            <span dir="auto" className="font-bold">
              {product?.name}
            </span>
            {product?.price && (
              <>
                {" · "}
                <span>{formatMoney(product.price, locale)}</span>
              </>
            )}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="pb-6">{product && <History product={product} />}</SheetBody>
      </SheetContent>
    </Sheet>
  );
}
