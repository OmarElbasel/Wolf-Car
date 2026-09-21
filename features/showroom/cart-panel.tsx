"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ShowroomProduct } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ORDER_MAX_QUANTITY } from "@/shared/validation";
import { lineTotal } from "./cart";
import { ProductImage } from "./product-card";

export interface CartEntry {
  product: ShowroomProduct;
  quantity: number;
}

export interface CartHandlers {
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
}

function Stepper({ entry, onIncrement, onDecrement }: { entry: CartEntry } & Omit<CartHandlers, "onRemove">) {
  const t = useTranslations("Showroom");
  const { product, quantity } = entry;
  return (
    <div
      role="group"
      aria-label={t("quantityOf", { name: product.name })}
      className="flex items-center rounded-[var(--radius-brand)] border-[1.5px] border-line"
    >
      <Button
        variant="ghost"
        size="icon-lg"
        className="rounded-e-none text-ink"
        aria-label={t("decrease", { name: product.name })}
        onClick={() => onDecrement(product.id)}
      >
        <Minus className="size-5" aria-hidden="true" strokeWidth={2.2} />
      </Button>
      <output className="w-11 text-center text-lg font-extrabold tabular-nums" aria-live="polite" data-testid="line-quantity">
        {quantity}
      </output>
      <Button
        variant="ghost"
        size="icon-lg"
        className="rounded-s-none text-ink"
        aria-label={t("increase", { name: product.name })}
        disabled={quantity >= ORDER_MAX_QUANTITY}
        onClick={() => onIncrement(product.id)}
      >
        <Plus className="size-5" aria-hidden="true" strokeWidth={2.2} />
      </Button>
    </div>
  );
}

function CartLineRow({ entry, onIncrement, onDecrement, onRemove }: { entry: CartEntry } & CartHandlers) {
  const t = useTranslations("Showroom");
  const locale = useLocale();
  const { product, quantity } = entry;
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2.5 py-3.5">
      <div className="size-16 overflow-hidden rounded-[var(--radius-brand)] bg-sand">
        <ProductImage product={product} sizes="64px" />
      </div>
      <div className="min-w-0">
        {/* the name keeps its own direction (dir=auto) but stays aligned with its thumbnail */}
        <p className="line-clamp-2 text-start leading-snug font-bold">
          <span dir="auto">{product.name}</span>
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {t("each", { price: formatMoney(product.price, locale) })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-lg"
        className="-me-2 -mt-1 text-muted hover:bg-danger-soft hover:text-danger"
        aria-label={t("remove", { name: product.name })}
        onClick={() => onRemove(product.id)}
      >
        <Trash2 className="size-5" aria-hidden="true" strokeWidth={1.8} />
      </Button>
      <div className="col-span-3 flex items-center justify-between gap-3">
        <Stepper entry={entry} onIncrement={onIncrement} onDecrement={onDecrement} />
        <p className="text-lg font-extrabold tabular-nums">
          <span dir="ltr">{formatMoney(lineTotal(product.price, quantity), locale)}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * The cart contents with steppers, total and "Place order". Rendered in the
 * sticky side panel on wide screens and inside the bottom sheet on tablets.
 */
export function CartPanel({
  heading,
  entries,
  count,
  total,
  onClear,
  onCheckout,
  className,
  headerClassName,
  ...handlers
}: {
  heading: ReactNode;
  entries: CartEntry[];
  count: number;
  total: string;
  onClear: () => void;
  onCheckout: () => void;
  className?: string;
  headerClassName?: string;
} & CartHandlers) {
  const t = useTranslations("Showroom");
  const locale = useLocale();
  const empty = entries.length === 0;
  return (
    <section className={cn("flex h-full min-h-0 flex-col", className)} data-testid="cart-panel">
      <header className={cn("flex items-center justify-between gap-3 border-b border-line px-5 py-3", headerClassName)}>
        <div className="flex min-h-[50px] min-w-0 flex-col justify-center">
          {heading}
          <p className="text-sm font-semibold text-muted">{t("items", { count })}</p>
        </div>
        {!empty && (
          <Button variant="ghost" size="lg" className="-me-3 px-3 text-[15px] text-ink-2" onClick={onClear}>
            <Trash2 aria-hidden="true" strokeWidth={1.8} />
            {t("clear")}
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
        {empty ? (
          <div className="grid h-full min-h-48 place-items-center py-10 text-center">
            <div className="grid justify-items-center gap-3">
              <span className="grid size-16 place-items-center rounded-full bg-sand text-accent-ink">
                <ShoppingCart className="size-7" aria-hidden="true" strokeWidth={1.8} />
              </span>
              <div>
                <p className="text-lg font-bold">{t("cartEmpty")}</p>
                <p className="text-[15px] text-ink-2">{t("cartEmptyHint")}</p>
              </div>
            </div>
          </div>
        ) : (
          <ul aria-label={t("cart")}>
            <AnimatePresence initial={false}>
              {entries.map((entry) => (
                <motion.li
                  key={entry.product.id}
                  layout="position"
                  {...listItem}
                  className="overflow-hidden border-b border-line last:border-b-0"
                >
                  <CartLineRow entry={entry} {...handlers} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <footer className="border-t border-line px-5 pt-4 pb-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="text-lg font-bold text-ink-2">{t("total")}</p>
          <p className="text-[28px] leading-tight font-extrabold tabular-nums" aria-live="polite" data-testid="cart-total">
            <span dir="ltr">{formatMoney(total, locale)}</span>
          </p>
        </div>
        <Button size="touch" className="w-full" disabled={empty} onClick={onCheckout}>
          {t("checkout")}
        </Button>
      </footer>
    </section>
  );
}
