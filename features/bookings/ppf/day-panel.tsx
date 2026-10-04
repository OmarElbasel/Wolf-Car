"use client";

import { Ban, CalendarPlus, LockOpen, Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Pill } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { isolate } from "@/features/admin/shared/ui";
import type { DayInfo, PpfBooking } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { formatDay } from "../shared/dates";

const STATE_TONE = { OPEN: "success", FULL: "danger", CLOSED: "neutral" } as const;

/** The selected day: its state, what the call center can do with it, and its bookings. */
export function DayPanel({
  date,
  info,
  bookings,
  canManage,
  onAdd,
  onEdit,
  onCancel,
  onClose,
  onReopen,
}: {
  date: string;
  info: DayInfo | undefined;
  bookings: PpfBooking[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (booking: PpfBooking) => void;
  onCancel: (booking: PpfBooking) => void;
  onClose: () => void;
  onReopen: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const closed = info?.state === "CLOSED";

  return (
    <section aria-label={formatDay(date, locale)} className="rounded-[var(--radius-brand-lg)] border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg leading-tight font-extrabold">{formatDay(date, locale)}</h2>
        {info && <Pill tone={STATE_TONE[info.state]}>{t(`Calendar.states.${info.state}`)}</Pill>}
      </div>
      {closed && (
        <p className="mt-1 text-[15px] font-semibold text-ink-2">
          {info.reason ? t("PpfBookings.closedBecause", { reason: isolate(info.reason) }) : t("PpfBookings.closedNoReason")}
        </p>
      )}

      {canManage && info && (
        <div className="mt-3 flex flex-wrap gap-2">
          {closed ? (
            <Button variant="outline" onClick={onReopen}>
              <LockOpen aria-hidden="true" />
              {t("PpfBookings.reopen")}
            </Button>
          ) : (
            <>
              <Button onClick={onAdd}>
                <CalendarPlus aria-hidden="true" />
                {t("PpfBookings.add")}
              </Button>
              <Button variant="outline" onClick={onClose}>
                <Ban aria-hidden="true" />
                {t("PpfBookings.closeDay")}
              </Button>
            </>
          )}
        </div>
      )}

      {bookings.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">{t("PpfBookings.noBookings")}</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {bookings.map((b) => {
            const cancelled = b.status === "CANCELLED";
            return (
              <li key={b.id}>
                <article aria-label={b.car} className={cn("rounded-[var(--radius-brand)] border border-line p-3", cancelled && "opacity-60")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={b.type === "FULL" ? "danger" : "warning"}>{t(`PpfBookings.types.${b.type}`)}</Pill>
                    {cancelled && <Pill>{t("PpfBookings.cancelledBadge")}</Pill>}
                  </div>
                  <p dir="auto" className={cn("mt-2 text-[17px] font-extrabold", cancelled && "line-through decoration-1")}>
                    {b.car}
                  </p>
                  <p className="text-[15px] text-ink-2">
                    <span dir="auto">{b.ownerName}</span>
                    {b.phone && (
                      <>
                        {" · "}
                        <a href={`tel:${b.phone.replaceAll(" ", "")}`} dir="ltr" className="font-semibold underline underline-offset-2">
                          {b.phone}
                        </a>
                      </>
                    )}
                  </p>
                  {b.service && (
                    <p dir="auto" className="text-[15px] font-semibold">
                      {b.service}
                    </p>
                  )}
                  {b.deliveryDate && <p className="text-[14px] text-ink-2">{t("PpfBookings.delivery", { date: formatDay(b.deliveryDate, locale, "short") })}</p>}
                  {b.requestedBy && <p className="text-[14px] text-ink-2">{t("PpfBookings.requestedBy", { name: isolate(b.requestedBy) })}</p>}
                  {b.note && (
                    <p dir="auto" className="mt-1 text-[14px] whitespace-pre-line text-ink-2">
                      {b.note}
                    </p>
                  )}
                  {canManage && !cancelled && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(b)}>
                        <Pencil aria-hidden="true" />
                        {t("Common.edit")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onCancel(b)}>
                        {t("PpfBookings.cancelBooking")}
                      </Button>
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
