"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Barcode } from "@/components/barcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ShowroomProduct } from "@/lib/api/types";

/**
 * A product's barcode for a cashier who scans off the screen: small on the
 * card, large on tap. Always black bars on white, whatever the theme — a
 * scanner cannot read light bars on a dark card.
 */
export function ScanBarcode({ product }: { product: ShowroomProduct }) {
  const t = useTranslations("Showroom");
  const tc = useTranslations("Common");
  const [open, setOpen] = useState(false);
  if (!product.barcode) return null;
  return (
    <>
      <button
        type="button"
        aria-label={t("showBarcode", { name: product.name })}
        onClick={() => setOpen(true)}
        className="flex w-full justify-center overflow-hidden rounded-[var(--radius-brand)] border border-line bg-white px-2 py-1.5 text-black"
      >
        <Barcode value={product.barcode} height={40} moduleWidth={1.4} className="text-black" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tc("close")} aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle dir="auto">{product.name}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center overflow-x-auto rounded-[var(--radius-brand)] bg-white px-4 py-6 text-black">
            <Barcode value={product.barcode} height={130} moduleWidth={2.6} className="text-black" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
