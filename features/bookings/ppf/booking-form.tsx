"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors } from "@/features/admin/shared/forms";
import { useFieldError } from "@/features/admin/shared/ui";
import { api } from "@/lib/api/client";
import type { PpfBooking } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { cn } from "@/lib/utils";
import { BOOKING_NAME_MAX, BOOKING_NOTE_MAX, BOOKING_SERVICE_MAX } from "@/shared/validation";
import { dayField, nameField, optionalDay, optionalPhone, optionalText } from "../shared/schemas";

const TYPES = ["FULL", "LIGHT"] as const;
const FIELDS = ["type", "car", "ownerName", "phone", "service", "receiveDate", "deliveryDate", "note"] as const;

const schema = z
  .object({
    type: z.enum(TYPES),
    car: nameField,
    ownerName: nameField,
    phone: optionalPhone,
    service: optionalText(BOOKING_SERVICE_MAX),
    receiveDate: dayField,
    deliveryDate: optionalDay,
    note: optionalText(BOOKING_NOTE_MAX),
  })
  .refine((v) => v.deliveryDate === "" || v.deliveryDate >= v.receiveDate, { path: ["deliveryDate"], message: "deliveryBeforeReceive" });
type Input_ = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** Add or edit a PPF booking. Empty optional fields are sent as "" — the API reads that as "none". */
export function BookingDialog({
  open,
  onOpenChange,
  booking,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = a new booking on `defaultDate` */
  booking: PpfBooking | null;
  defaultDate: string;
  onSaved: () => void;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("Common.close")} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(booking ? "PpfBookings.editTitle" : "PpfBookings.addTitle")}</DialogTitle>
          <DialogDescription>{t("PpfBookings.subtitle")}</DialogDescription>
        </DialogHeader>
        <BookingForm booking={booking} defaultDate={defaultDate} onCancel={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function BookingForm({ booking, defaultDate, onCancel, onSaved }: { booking: PpfBooking | null; defaultDate: string; onCancel: () => void; onSaved: () => void }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Input_, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: booking?.type ?? "FULL",
      car: booking?.car ?? "",
      ownerName: booking?.ownerName ?? "",
      phone: booking?.phone ?? "",
      service: booking?.service ?? "",
      receiveDate: booking?.receiveDate ?? defaultDate,
      deliveryDate: booking?.deliveryDate ?? "",
      note: booking?.note ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      if (booking) await api(`/ppf/bookings/${booking.id}`, { method: "PATCH", json: values });
      else await api("/ppf/bookings", { method: "POST", json: values });
      toast.success(t("PpfBookings.saved"));
      onSaved();
    } catch (e) {
      const matched = applyFieldErrors(e, FIELDS, (f) => form.setError(f, { message: "invalid" }));
      if (!matched) setError(message(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {error && (
        <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-ink-2">{t("PpfBookings.type")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TYPES.map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-brand)] border-[1.5px] border-line p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
                type === value && "border-ink",
              )}
            >
              <input type="radio" value={value} className="mt-1 accent-[var(--color-accent)]" {...form.register("type")} />
              <span>
                <b className="block text-[15px]">{t(`PpfBookings.types.${value}`)}</b>
                <small className="text-[13px] text-muted">{t(`PpfBookings.typeHints.${value}`)}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t("PpfBookings.car")} hint={t("PpfBookings.carHint")} error={fe(errors.car?.message, { max: BOOKING_NAME_MAX })}>
        <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} autoFocus {...form.register("car")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("PpfBookings.ownerName")} error={fe(errors.ownerName?.message, { max: BOOKING_NAME_MAX })}>
          <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("ownerName")} />
        </Field>
        <Field label={t("PpfBookings.phone")} optional error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="off" dir="ltr" className="text-start" maxLength={20} {...form.register("phone")} />
        </Field>
      </div>
      <Field label={t("PpfBookings.service")} optional error={fe(errors.service?.message, { max: BOOKING_SERVICE_MAX })}>
        <Input autoComplete="off" dir="auto" maxLength={BOOKING_SERVICE_MAX} {...form.register("service")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("PpfBookings.receiveDate")} error={errors.receiveDate?.message}>
          <Input type="date" dir="ltr" {...form.register("receiveDate")} />
        </Field>
        <Field label={t("PpfBookings.deliveryDate")} optional error={errors.deliveryDate?.message}>
          <Input type="date" dir="ltr" {...form.register("deliveryDate")} />
        </Field>
      </div>
      <Field label={t("PpfBookings.note")} optional error={fe(errors.note?.message, { max: BOOKING_NOTE_MAX })}>
        <Textarea dir="auto" rows={3} maxLength={BOOKING_NOTE_MAX} {...form.register("note")} />
      </Field>
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("Common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("Common.saving") : t("Common.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
