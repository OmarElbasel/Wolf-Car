"use client";

import { Check, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ShowroomProduct } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { fast, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Card grid column widths → which image the browser should pick (480px thumb vs 1200px). */
export const PRODUCT_IMAGE_SIZES = "(min-width: 1536px) 22vw, (min-width: 1024px) 26vw, (min-width: 560px) 50vw, 100vw";

export function ProductImage({ product, sizes, className }: { product: ShowroomProduct; sizes: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- API-served webp renditions with an explicit srcset; no optimizer round-trip
    <img
      src={product.thumbUrl}
      srcSet={`${product.thumbUrl} 480w, ${product.imageUrl} 1200w`}
      sizes={sizes}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("size-full object-cover", className)}
    />
  );
}

/**
 * One product on the kiosk. Taps are never blocked: every tap adds one, the
 * quantity badge pops and the button briefly confirms with a check mark.
 */
export function ProductCard({
  product,
  quantity,
  onAdd,
}: {
  product: ShowroomProduct;
  quantity: number;
  /** returns false when the cart limits stopped the add */
  onAdd: () => boolean;
}) {
  const t = useTranslations("Showroom");
  const locale = useLocale();
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(0), 1100);
    return () => clearTimeout(id);
  }, [flash]);

  const added = flash > 0;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-[var(--radius-brand-lg)] border bg-surface transition-colors",
        quantity > 0 ? "border-accent" : "border-line",
      )}
      aria-label={product.name}
    >
      <div className="relative aspect-[4/3] bg-sand">
        <ProductImage product={product} sizes={PRODUCT_IMAGE_SIZES} />
        {quantity > 0 && (
          <motion.span
            key={quantity}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
            className="absolute end-3 top-3 grid h-11 min-w-11 place-items-center rounded-full bg-accent px-2 text-lg font-extrabold text-white tabular-nums"
            data-testid="card-quantity"
          >
            <span aria-hidden="true">{quantity}</span>
            <span className="sr-only">{t("inCart", { count: quantity })}</span>
          </motion.span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 dir="auto" className="line-clamp-2 text-start text-[17px] leading-snug font-bold">
          {product.name}
        </h3>
        {product.description && (
          <p dir="auto" className="mt-1 line-clamp-3 text-start text-sm leading-relaxed text-ink-2">
            {product.description}
          </p>
        )}
        {product.barcode && (
          <p className="mt-1.5 text-xs text-muted">
            {t.rich("barcode", {
              code: product.barcode,
              num: (chunks) => (
                <span dir="ltr" className="font-mono">
                  {chunks}
                </span>
              ),
            })}
          </p>
        )}
        <div className="mt-auto pt-3">
          <p className="text-[22px] leading-tight font-extrabold tabular-nums">
            <span dir="ltr">{formatMoney(product.price, locale)}</span>
          </p>
          <Button
            size="touch"
            className="mt-3 w-full"
            aria-label={t("addNamed", { name: product.name })}
            onClick={() => {
              if (onAdd()) setFlash((n) => n + 1);
            }}
          >
            <motion.span
              key={added ? "added" : "add"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={fast}
              className="inline-flex items-center gap-2"
            >
              {added ? <Check aria-hidden="true" strokeWidth={2.4} /> : <Plus aria-hidden="true" strokeWidth={2.2} />}
              {added ? t("added") : t("add")}
            </motion.span>
          </Button>
        </div>
      </div>
    </article>
  );
}
