"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import type { GeneralReservation } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { BOOKING_NAME_MAX, BOOKING_NOTE_MAX, BOOKING_SERVICE_MAX } from "@/shared/validation";
import { dayField, optionalName, optionalPhone, optionalText, optionalTime, requiredText } from "../shared/schemas";

const FIELDS = ["date", "time", "service", "ownerName", "phone", "car", "note"] as const;

const schema = z.object({
  date: dayField,
  time: optionalTime,
  service: requiredText(BOOKING_SERVICE_MAX),
  ownerName: optionalName,
  phone: optionalPhone,
  car: optionalName,
  note: optionalText(BOOKING_NOTE_MAX),
});
type Input_ = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** Add or edit a general reservation. Empty optional fields are sent as "" — the API reads that as "none". */
export function ReservationDialog({
  open,
  onOpenChange,
  reservation,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = a new reservation on `defaultDate` */
  reservation: GeneralReservation | null;
  defaultDate: string;
  onSaved: () => void;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("Common.close")} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(reservation ? "Reservations.editTitle" : "Reservations.addTitle")}</DialogTitle>
          <DialogDescription>{t("Reservations.subtitle")}</DialogDescription>
        </DialogHeader>
        <ReservationForm reservation={reservation} defaultDate={defaultDate} onCancel={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function ReservationForm({
  reservation,
  defaultDate,
  onCancel,
  onSaved,
}: {
  reservation: GeneralReservation | null;
  defaultDate: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Input_, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: reservation?.date ?? defaultDate,
      time: reservation?.time ?? "",
      service: reservation?.service ?? "",
      ownerName: reservation?.ownerName ?? "",
      phone: reservation?.phone ?? "",
      car: reservation?.car ?? "",
      note: reservation?.note ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      if (reservation) await api(`/reservations/${reservation.id}`, { method: "PATCH", json: values });
      else await api("/reservations", { method: "POST", json: values });
      toast.success(t("Reservations.saved"));
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Reservations.date")} error={errors.date?.message}>
          <Input type="date" dir="ltr" {...form.register("date")} />
        </Field>
        <Field label={t("Reservations.time")} optional error={errors.time?.message}>
          <Input type="time" dir="ltr" {...form.register("time")} />
        </Field>
      </div>
      <Field label={t("Reservations.service")} error={fe(errors.service?.message, { max: BOOKING_SERVICE_MAX })}>
        <Input autoComplete="off" dir="auto" maxLength={BOOKING_SERVICE_MAX} autoFocus {...form.register("service")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Reservations.ownerName")} optional error={fe(errors.ownerName?.message, { max: BOOKING_NAME_MAX })}>
          <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("ownerName")} />
        </Field>
        <Field label={t("Reservations.phone")} optional error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="off" dir="ltr" className="text-start" maxLength={20} {...form.register("phone")} />
        </Field>
      </div>
      <Field label={t("Reservations.car")} optional error={fe(errors.car?.message, { max: BOOKING_NAME_MAX })}>
        <Input autoComplete="off" dir="auto" maxLength={BOOKING_NAME_MAX} {...form.register("car")} />
      </Field>
      <Field label={t("Reservations.note")} optional error={fe(errors.note?.message, { max: BOOKING_NOTE_MAX })}>
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
