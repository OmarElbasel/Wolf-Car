"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import type { Product } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { formatMoney } from "@/lib/format";
import { PRICE_PATTERN } from "@/shared/validation";
import { isolate } from "./bidi";
import { productKeys } from "./queries";

/** Arabic-Indic digits and the Arabic decimal separator typed on an Arabic keyboard → "125.50". */
export function normalizePrice(input: string): string {
  return input
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, ".");
}

const schema = z.object({
  price: z
    .string()
    .transform(normalizePrice)
    .pipe(z.string().min(1, "required").regex(PRICE_PATTERN, "price")),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

function PriceForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const t = useTranslations("Products.price");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(schema), defaultValues: { price: "" } });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ price }) => {
    try {
      await api<Product>(`/products/${product.id}/price`, { method: "PATCH", json: { price } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: productKeys.history(product.id) }),
      ]);
      toast.success(t("saved"));
      onDone();
    } catch (error) {
      toast.error(message(error));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-brand)] bg-sand px-3 py-2.5">
        <span className="text-sm font-bold text-ink-2">{t("current")}</span>
        {product.price === null ? (
          <span className="text-sm font-bold text-warning">{t("notSet")}</span>
        ) : (
          <span className="font-extrabold tabular-nums">
            {formatMoney(product.price, locale)}
          </span>
        )}
      </div>
      <Field label={t("label")} error={errors.price?.message}>
        <Input
          inputMode="decimal"
          dir="ltr"
          autoComplete="off"
          placeholder="125.50"
          className="text-start font-mono tabular-nums"
          autoFocus
          {...form.register("price")}
        />
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={isSubmitting}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tc("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Finance sets or changes a price: PATCH /products/:id/price with only { price }. */
export function PriceDialog({ open, product, onOpenChange }: { open: boolean; product: Product | null; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("Products.price");
  const tc = useTranslations("Common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tc("close")}>
        {product && (
          <>
            <DialogHeader>
              <DialogTitle>{t("title", { name: isolate(product.name) })}</DialogTitle>
              <DialogDescription>{product.price === null ? t("set") : t("change")}</DialogDescription>
            </DialogHeader>
            <PriceForm key={product.id} product={product} onDone={() => onOpenChange(false)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
