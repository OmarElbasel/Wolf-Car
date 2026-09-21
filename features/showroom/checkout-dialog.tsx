"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api/client";
import { fieldErrors } from "@/lib/api/errors";
import type { OrderDetail } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { formatMoney } from "@/lib/format";
import { CUSTOMER_NAME_MAX, CUSTOMER_NAME_MIN, CUSTOMER_NAME_PATTERN } from "@/shared/validation";
import type { CartLine } from "./cart";

/** Same normalisation as the API: trimmed, inner whitespace collapsed. */
const normaliseName = (value: string) => value.trim().replace(/\s+/g, " ");

const customerSchema = z.object({
  customerName: z
    .string()
    .transform(normaliseName)
    .pipe(
      z
        .string()
        .min(1, "required")
        .min(CUSTOMER_NAME_MIN, "tooShort")
        .max(CUSTOMER_NAME_MAX, "tooLong")
        .regex(CUSTOMER_NAME_PATTERN, "customerName"),
    ),
});
type CustomerInput = z.input<typeof customerSchema>;
type CustomerValues = z.output<typeof customerSchema>;

export interface CheckoutProps {
  lines: CartLine[];
  count: number;
  total: string;
  userId: string;
  /** one key per checkout attempt; reused when the same checkout is retried */
  idempotencyKey: string;
  onPlaced: (order: OrderDetail) => void;
  /** refetches the catalogue and prunes the cart; resolves with the lines still in the cart */
  onUnavailable: () => Promise<number>;
  onClose: () => void;
}

function CheckoutForm({ lines, count, total, userId, idempotencyKey, onPlaced, onUnavailable, onClose }: CheckoutProps) {
  const t = useTranslations("Showroom");
  const tc = useTranslations("Common");
  const tv = useTranslations("Validation");
  const locale = useLocale();
  const message = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CustomerInput, unknown, CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { customerName: "" },
  });

  const place = useMutation({
    mutationFn: (customerName: string) =>
      api<OrderDetail>("/showroom/orders", {
        audience: "showroom",
        method: "POST",
        json: { items: lines.map(({ productId, quantity }) => ({ productId, quantity })), customerName, userId },
        headers: { "Idempotency-Key": idempotencyKey },
      }),
  });

  const submit = form.handleSubmit(async ({ customerName }) => {
    setError(null);
    try {
      onPlaced(await place.mutateAsync(customerName));
    } catch (e) {
      if (e instanceof ApiError && e.code === "PRODUCT_UNAVAILABLE") {
        const remaining = await onUnavailable();
        if (remaining > 0) setError(message(e));
        else {
          toast.error(message(e));
          onClose();
        }
        return;
      }
      if (fieldErrors(e).customerName) {
        form.setError("customerName", { message: "customerName" }, { shouldFocus: true });
        return;
      }
      toast.error(message(e));
    }
  });

  const busy = form.formState.isSubmitting;
  const nameError = form.formState.errors.customerName?.message;
  const nameErrorText =
    nameError === "tooShort"
      ? tv("tooShort", { min: CUSTOMER_NAME_MIN })
      : nameError === "tooLong"
        ? tv("tooLong", { max: CUSTOMER_NAME_MAX })
        : nameError;
  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-brand)] bg-sand px-4 py-3">
        <span className="font-bold text-ink-2">{t("items", { count })}</span>
        <span className="text-xl font-extrabold tabular-nums">
          <span dir="ltr">{formatMoney(total, locale)}</span>
        </span>
      </div>
      {error && (
        <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      <Field label={<span className="text-base">{t("customerName")}</span>} error={nameErrorText}>
        <Input
          dir="auto"
          autoFocus
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="send"
          maxLength={CUSTOMER_NAME_MAX}
          className="h-[60px] text-start text-xl md:text-xl"
          {...form.register("customerName")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" size="touch" disabled={busy} onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button type="submit" size="touch" disabled={busy}>
          <Send className="rtl:-scale-x-100" aria-hidden="true" />
          {busy ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

/** Asks for the customer's name and places the order (idempotent across retries). */
export function CheckoutDialog({
  open,
  restoreFocus,
  ...props
}: CheckoutProps & { open: boolean; restoreFocus: () => boolean }) {
  const t = useTranslations("Showroom");
  const tc = useTranslations("Common");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && props.onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        closeLabel={tc("close")}
        onCloseAutoFocus={(e) => {
          // after a successful order the full-screen confirmation owns focus
          if (!restoreFocus()) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[22px]">{t("customerTitle")}</DialogTitle>
          <DialogDescription>{t("customerBody")}</DialogDescription>
        </DialogHeader>
        <CheckoutForm {...props} />
      </DialogContent>
    </Dialog>
  );
}
