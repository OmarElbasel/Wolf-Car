"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { ErrorState, NoAccess } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api/client";
import type { PpfBooking } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { qatarDay } from "@/lib/format";
import { CLOSE_REASON_MAX } from "@/shared/validation";
import { formatDay, monthOf } from "../shared/dates";
import { MonthCalendar } from "../shared/month-calendar";
import { BookingDialog } from "./booking-form";
import { DayPanel } from "./day-panel";
import { fetchCalendar, ppfKeys, usePendingRequests } from "./queries";
import { RequestsInbox } from "./requests-inbox";
import { SalesAccessCard } from "./sales-access-card";

/** The call center's PPF calendar for Bin Omran. */
export function PpfBookingsPage() {
  const t = useTranslations("PpfBookings");
  const { can } = useAuth();
  if (!can("booking.ppf.read")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess permission="booking.ppf.read" />
      </>
    );
  }
  return <PpfManager canManage={can("booking.ppf.manage")} />;
}

function PpfManager({ canManage }: { canManage: boolean }) {
  const t = useTranslations("PpfBookings");
  const pending = usePendingRequests(true);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Tabs defaultValue="calendar">
        <TabsList className="mb-5">
          <TabsTrigger value="calendar">{t("tabCalendar")}</TabsTrigger>
          <TabsTrigger value="requests">
            {t("tabRequests")}
            {pending > 0 && (
              <span className="ms-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[12px] font-extrabold text-white tabular-nums">
                <span aria-hidden="true">{pending}</span>
                <span className="sr-only">{t("pending", { count: pending })}</span>
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calendar">
          <CalendarTab canManage={canManage} />
          <SalesAccessCard canManage={canManage} />
        </TabsContent>
        <TabsContent value="requests">
          <RequestsInbox canManage={canManage} />
        </TabsContent>
      </Tabs>
    </>
  );
}

export function CalendarTab({ canManage }: { canManage: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => monthOf(qatarDay(new Date())));
  const [selected, setSelected] = useState(() => qatarDay(new Date()));
  const [form, setForm] = useState<{ open: boolean; booking: PpfBooking | null }>({ open: false, booking: null });
  const [cancelling, setCancelling] = useState<PpfBooking | null>(null);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");

  const calendar = useQuery({ queryKey: ppfKeys.calendar(month), queryFn: () => fetchCalendar(month) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ppfKeys.all });
  const info = calendar.data?.days.find((d) => d.date === selected);
  const bookings = calendar.data?.bookings.filter((b) => b.receiveDate === selected) ?? [];

  const changeMonth = (next: string) => {
    const today = qatarDay(new Date());
    setMonth(next);
    setSelected(monthOf(today) === next ? today : `${next}-01`);
  };

  /** Runs a change, reports it, and refreshes either way (a refusal usually means the data moved on). */
  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast.success(done);
    } catch (e) {
      toast.error(message(e));
      throw e;
    } finally {
      await refresh();
    }
  };

  if (calendar.isError && !calendar.data) return <ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} />;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <MonthCalendar month={month} days={calendar.data?.days} today={calendar.data?.today} selected={selected} onSelect={setSelected} onMonthChange={changeMonth} />
      <DayPanel
        date={selected}
        info={info}
        bookings={bookings}
        canManage={canManage}
        onAdd={() => setForm({ open: true, booking: null })}
        onEdit={(booking) => setForm({ open: true, booking })}
        onCancel={setCancelling}
        onClose={() => {
          setReason("");
          setClosing(true);
        }}
        onReopen={() => void run(() => api(`/ppf/closed-days/${selected}`, { method: "DELETE" }), t("PpfBookings.dayReopened")).catch(() => undefined)}
      />

      <BookingDialog
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        booking={form.booking}
        defaultDate={selected}
        onSaved={() => {
          setForm((f) => ({ ...f, open: false }));
          void refresh();
        }}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={t("PpfBookings.cancelTitle")}
        body={t("PpfBookings.cancelBody")}
        confirmLabel={t("PpfBookings.cancelBooking")}
        cancelLabel={t("Common.back")}
        destructive
        onConfirm={() => run(() => api(`/ppf/bookings/${cancelling?.id}/cancel`, { method: "POST" }), t("PpfBookings.cancelled"))}
      />

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent closeLabel={t("Common.close")} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("PpfBookings.closeTitle")}</DialogTitle>
            <DialogDescription>
              {formatDay(selected, locale)}. {t("PpfBookings.closeBody")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api(`/ppf/closed-days/${selected}`, { method: "PUT", json: { reason } }), t("PpfBookings.dayClosed"))
                .then(() => setClosing(false))
                .catch(() => undefined);
            }}
          >
            <Field label={t("PpfBookings.reason")} optional>
              <Input dir="auto" autoComplete="off" maxLength={CLOSE_REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setClosing(false)}>
                {t("Common.cancel")}
              </Button>
              <Button type="submit">{t("PpfBookings.closeDay")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
