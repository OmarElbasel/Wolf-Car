"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/app/badges";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, ErrorState, LoadingRows, NoAccess } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api/client";
import type { GeneralReservation, Page } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { qatarDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatDay } from "../shared/dates";
import { ReservationDialog } from "./reservation-form";

/** The call center's private list of every reservation that is not a PPF booking. */
export function ReservationsPage() {
  const t = useTranslations("Reservations");
  const { can } = useAuth();
  if (!can("booking.general.manage")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess permission="booking.general.manage" />
      </>
    );
  }
  return <ReservationsManager />;
}

function ReservationsManager() {
  const t = useTranslations();
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(() => qatarDay(new Date()));
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [form, setForm] = useState<{ open: boolean; reservation: GeneralReservation | null }>({ open: false, reservation: null });
  const [cancelling, setCancelling] = useState<GeneralReservation | null>(null);

  // the list follows the search box a moment after typing stops
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const filters = { from, to, q, status: showCancelled ? "" : "BOOKED" };
  const list = useQuery({
    queryKey: ["reservations", filters],
    queryFn: () => api<Page<GeneralReservation>>("/reservations", { query: { ...filters, pageSize: 100 } }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["reservations"] });

  const groups: { date: string; items: GeneralReservation[] }[] = [];
  for (const r of list.data?.items ?? []) {
    const last = groups.at(-1);
    if (last?.date === r.date) last.items.push(r);
    else groups.push({ date: r.date, items: [r] });
  }

  return (
    <>
      <PageHeader
        title={t("Reservations.title")}
        subtitle={t("Reservations.subtitle")}
        actions={
          <Button onClick={() => setForm({ open: true, reservation: null })}>
            <Plus aria-hidden="true" />
            {t("Reservations.add")}
          </Button>
        }
      />

      <div className="mb-5 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
        <Input
          type="search"
          dir="auto"
          aria-label={t("Reservations.search")}
          placeholder={t("Reservations.search")}
          value={search}
          maxLength={80}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Field label={t("Common.dateFrom")}>
          <Input type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("Common.dateTo")}>
          <Input type="date" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px] font-semibold">
          <Checkbox checked={showCancelled} onCheckedChange={(v) => setShowCancelled(v === true)} />
          {t("Reservations.showCancelled")}
        </label>
      </div>

      {list.isPending ? (
        <LoadingRows rows={4} className="h-24" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState title={t("Reservations.empty")} />
      ) : (
        <div className="grid gap-6">
          {groups.map((group) => (
            <section key={group.date}>
              <h2 className="mb-2 text-[17px] font-extrabold">{formatDay(group.date, locale)}</h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {group.items.map((r) => {
                  const cancelled = r.status === "CANCELLED";
                  return (
                    <li key={r.id}>
                      <article aria-label={r.service} className={cn("h-full rounded-[var(--radius-brand)] border border-line p-4", cancelled && "opacity-60")}>
                        <div className="flex flex-wrap items-center gap-2">
                          {r.time && (
                            <span dir="ltr" className="text-[15px] font-extrabold tabular-nums">
                              {r.time}
                            </span>
                          )}
                          {cancelled && <Pill>{t("Reservations.cancelledBadge")}</Pill>}
                        </div>
                        <p dir="auto" className={cn("text-[17px] font-extrabold", cancelled && "line-through decoration-1")}>
                          {r.service}
                        </p>
                        {(r.ownerName || r.phone) && (
                          <p className="text-[15px] text-ink-2">
                            {r.ownerName && <span dir="auto">{r.ownerName}</span>}
                            {r.ownerName && r.phone && " · "}
                            {r.phone && <span dir="ltr">{r.phone}</span>}
                          </p>
                        )}
                        {r.car && (
                          <p dir="auto" className="text-[15px] font-semibold">
                            {r.car}
                          </p>
                        )}
                        {r.note && (
                          <p dir="auto" className="mt-1 text-[14px] whitespace-pre-line text-ink-2">
                            {r.note}
                          </p>
                        )}
                        {!cancelled && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => setForm({ open: true, reservation: r })}>
                              <Pencil aria-hidden="true" />
                              {t("Common.edit")}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCancelling(r)}>
                              {t("Reservations.cancel")}
                            </Button>
                          </div>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ReservationDialog
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        reservation={form.reservation}
        defaultDate={from || qatarDay(new Date())}
        onSaved={() => {
          setForm((f) => ({ ...f, open: false }));
          void refresh();
        }}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={t("Reservations.cancelTitle")}
        body={t("Reservations.cancelBody")}
        confirmLabel={t("Reservations.cancel")}
        cancelLabel={t("Common.back")}
        destructive
        onConfirm={async () => {
          try {
            await api(`/reservations/${cancelling?.id}/cancel`, { method: "POST" });
            toast.success(t("Reservations.cancelled"));
          } catch (e) {
            toast.error(message(e));
            throw e;
          } finally {
            await refresh();
          }
        }}
      />
    </>
  );
}
