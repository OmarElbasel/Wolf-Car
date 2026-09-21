"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import type { OrderDetail, OrderItem } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { listItem } from "@/lib/motion";
import { CUSTOMER_NAME_MAX, CUSTOMER_NAME_MIN, CUSTOMER_NAME_PATTERN, ORDER_MAX_QUANTITY } from "@/shared/validation";

/** Same normalisation as the API (trim, collapse spaces). */
export const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");

const schema = z.object({
  customerName: z
    .string()
    .transform(normalizeName)
    .pipe(
      z
        .string()
        .min(1, "required")
        .min(CUSTOMER_NAME_MIN, "tooShort")
        .max(CUSTOMER_NAME_MAX, "tooLong")
        .regex(CUSTOMER_NAME_PATTERN, "customerName"),
    ),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

export const cents = (amount: string) => Math.round(Number(amount) * 100);

/**
 * Inline edit of a pending order (or any order for the Super Admin): customer
 * name, quantities (1–99) and removing lines (at least one stays). Sends only
 * the parts that changed.
 */
export function OrderEditor({
  order,
  onSaved,
  onCancel,
  onError,
}: {
  order: OrderDetail;
  onSaved: (updated: OrderDetail) => void;
  onCancel: () => void;
  onError: (error: unknown) => void;
}) {
  const t = useTranslations("Orders");
  const tv = useTranslations("Validation");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<OrderItem[]>(() => order.items.map((i) => ({ ...i })));
  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(schema), defaultValues: { customerName: order.customerName } });
  const { errors, isSubmitting } = form.formState;

  const setQuantity = (id: string, quantity: number) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, quantity: Math.min(ORDER_MAX_QUANTITY, Math.max(1, quantity)) } : l)));
  const remove = (id: string) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.id !== id) : ls));

  const total = lines.reduce((sum, l) => sum + cents(l.unitPrice) * l.quantity, 0) / 100;
  const nameError = errors.customerName?.message;

  const save = form.handleSubmit(async ({ customerName }) => {
    const body: { customerName?: string; items?: { productId: string; quantity: number }[] } = {};
    if (customerName !== order.customerName) body.customerName = customerName;
    const itemsChanged =
      lines.length !== order.items.length || lines.some((l) => order.items.find((i) => i.id === l.id)?.quantity !== l.quantity);
    if (itemsChanged) body.items = lines.map((l) => ({ productId: l.productId, quantity: l.quantity }));
    if (!body.customerName && !body.items) {
      onCancel();
      return;
    }
    try {
      const updated = await api<OrderDetail>(`/orders/${order.id}`, { method: "PATCH", json: body });
      queryClient.setQueryData(["orders", "detail", order.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
      toast.success(t("saved"));
      onSaved(updated);
    } catch (error) {
      onError(error);
    }
  });

  return (
    <form onSubmit={save} noValidate className="flex flex-1 flex-col gap-4">
      <SheetBody className="grid content-start gap-5 pb-4">
        {order.status !== "PENDING" && (
          <p className="flex items-start gap-2 rounded-[var(--radius-brand)] bg-warning-soft p-3 text-sm font-semibold text-warning">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {order.status === "CANCELLED" ? t("adminOverrideCancelled") : t("adminOverride")}
          </p>
        )}
        <Field
          label={t("customerName")}
          error={nameError === "tooShort" ? tv("tooShort", { min: CUSTOMER_NAME_MIN }) : nameError === "tooLong" ? tv("tooLong", { max: CUSTOMER_NAME_MAX }) : nameError}
        >
          <Input dir="auto" autoComplete="off" {...form.register("customerName")} />
        </Field>

        <section aria-labelledby="edit-lines" className="grid gap-2">
          <h3 id="edit-lines" className="text-sm font-bold text-ink-2">
            {t("items")} · {t("lines", { count: lines.length })}
          </h3>
          <ul className="grid rounded-[var(--radius-brand-lg)] border border-line">
            <AnimatePresence initial={false}>
              {lines.map((line) => (
                <motion.li key={line.id} {...listItem} className="overflow-hidden border-b border-line last:border-b-0">
                  <div className="flex flex-wrap items-center gap-3 p-3">
                    <Image
                      src={line.thumbUrl}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="size-12 shrink-0 rounded-[var(--radius-brand)] border border-line bg-sand object-cover"
                    />
                    <div className="min-w-0 flex-1 basis-40">
                      <p dir="auto" className="w-fit max-w-full truncate font-bold">
                        {line.productName}
                      </p>
                      <p className="text-[13px] text-muted">
                        {t("unitPrice")}{" "}
                        <span className="tabular-nums">
                          {formatMoney(line.unitPrice, locale)}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center rounded-[var(--radius-brand)] border-[1.5px] border-line">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("decrease", { name: line.productName })}
                          disabled={line.quantity <= 1 || isSubmitting}
                          onClick={() => setQuantity(line.id, line.quantity - 1)}
                        >
                          <Minus aria-hidden="true" />
                        </Button>
                        <output dir="ltr" aria-live="polite" className="w-8 text-center font-extrabold tabular-nums">
                          {line.quantity}
                        </output>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("increase", { name: line.productName })}
                          disabled={line.quantity >= ORDER_MAX_QUANTITY || isSubmitting}
                          onClick={() => setQuantity(line.id, line.quantity + 1)}
                        >
                          <Plus aria-hidden="true" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger hover:bg-danger-soft hover:text-danger"
                        aria-label={t("removeLine", { name: line.productName })}
                        disabled={lines.length <= 1 || isSubmitting}
                        onClick={() => remove(line.id)}
                      >
                        <Trash2 className="size-5" strokeWidth={1.8} aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {lines.length <= 1 && <p className="text-[13px] text-muted">{t("minOneLine")}</p>}
          <p className="flex items-center justify-between gap-3 px-1 text-[17px] font-extrabold">
            <span>{t("grandTotal")}</span>
            <span className="tabular-nums">
              {formatMoney(total, locale)}
            </span>
          </p>
        </section>
      </SheetBody>
      <SheetFooter>
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("cancelEdit")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tc("saving") : t("saveChanges")}
        </Button>
      </SheetFooter>
    </form>
  );
}
