"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFieldError } from "@/features/admin/shared/ui";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { BOOKING_NAME_MAX, BOOKING_NOTE_MAX } from "@/shared/validation";
import { formatDay } from "../shared/dates";
import { nameField, optionalPhone, requiredText } from "../shared/schemas";
import { slotsApi } from "./api";

const NAME_KEY = "wc_sales_name";
/** The salesperson's name is kept on the phone so it is typed once (storage may be blocked: then it is just asked again). */
function rememberedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // private mode: nothing to do
  }
}

const schema = z.object({
  salesName: nameField,
  car: nameField,
  ownerName: nameField,
  phone: optionalPhone,
  note: requiredText(BOOKING_NOTE_MAX),
});
type Input_ = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** Asks the call center to fit a light job into a day closed by a full PPF. */
export function RequestDialog({ date, open, onOpenChange, onSent }: { date: string; open: boolean; onOpenChange: (open: boolean) => void; onSent: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("Common.close")} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Slots.requestTitle")}</DialogTitle>
          <DialogDescription>
            {formatDay(date, locale)}. {t("Slots.requestBody")}
          </DialogDescription>
        </DialogHeader>
        <RequestForm date={date} onCancel={() => onOpenChange(false)} onSent={onSent} />
      </DialogContent>
    </Dialog>
  );
}

function RequestForm({ date, onCancel, onSent }: { date: string; onCancel: () => void; onSent: () => void }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Input_, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: { salesName: rememberedName(), car: "", ownerName: "", phone: "", note: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await slotsApi("/requests", { method: "POST", json: { date, ...values } });
      rememberName(values.salesName);
      toast.success(t("Slots.sent"));
      onSent();
    } catch (e) {
      setError(message(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {error && (
        <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      <Field label={t("Slots.salesName")} error={fe(errors.salesName?.message, { max: BOOKING_NAME_MAX })}>
        <Input autoComplete="name" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("salesName")} />
      </Field>
      <Field label={t("Slots.car")} error={fe(errors.car?.message, { max: BOOKING_NAME_MAX })}>
        <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("car")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Slots.ownerName")} error={fe(errors.ownerName?.message, { max: BOOKING_NAME_MAX })}>
          <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("ownerName")} />
        </Field>
        <Field label={t("Slots.phone")} optional error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="off" dir="ltr" className="text-start" maxLength={20} {...form.register("phone")} />
        </Field>
      </div>
      <Field label={t("Slots.note")} error={fe(errors.note?.message, { max: BOOKING_NOTE_MAX })}>
        <Textarea dir="auto" rows={3} maxLength={BOOKING_NOTE_MAX} {...form.register("note")} />
      </Field>
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("Common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("Common.saving") : t("Slots.send")}
        </Button>
      </DialogFooter>
    </form>
  );
}
