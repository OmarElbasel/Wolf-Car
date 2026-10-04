"use client";

import { useLocale, useTranslations } from "next-intl";
import { Pill } from "@/components/app/badges";
import { isolate } from "@/features/admin/shared/ui";
import type { RequestStatus, SalesBooking, SalesRequest } from "@/lib/api/types";
import { formatDay } from "../shared/dates";

const TONE: Record<RequestStatus, "warning" | "success" | "neutral"> = { PENDING: "warning", APPROVED: "success", REJECTED: "neutral" };

/** What is already booked from today on, and what happened to recent light-job requests. */
export function SidePanel({ bookings, requests }: { bookings: SalesBooking[]; requests: SalesRequest[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const short = (day: string) => formatDay(day, locale, "short");

  return (
    <div className="grid gap-6 p-4">
      <section>
        <h3 className="mb-2 text-[15px] font-extrabold text-ink-2">{t("Slots.cars")}</h3>
        {bookings.length === 0 ? (
          <p className="text-[15px] text-muted">{t("Slots.noCars")}</p>
        ) : (
          <ul className="grid gap-2.5">
            {bookings.map((b) => (
              <li key={b.id}>
                <article aria-label={b.car} className="rounded-[var(--radius-brand)] border border-line p-3">
                  <Pill tone={b.type === "FULL" ? "danger" : "warning"}>{t(`PpfBookings.types.${b.type}`)}</Pill>
                  <p dir="auto" className="mt-1.5 text-[16px] font-extrabold">
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
                  <p className="mt-1 text-[14px] font-semibold">{t("Slots.receive", { date: short(b.receiveDate) })}</p>
                  <p className="text-[14px] text-ink-2">{b.deliveryDate ? t("Slots.delivery", { date: short(b.deliveryDate) }) : t("Slots.noDelivery")}</p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[15px] font-extrabold text-ink-2">{t("Slots.requests")}</h3>
        {requests.length === 0 ? (
          <p className="text-[15px] text-muted">{t("Slots.noRequests")}</p>
        ) : (
          <ul className="grid gap-2.5">
            {requests.map((r) => (
              <li key={r.id}>
                <article aria-label={r.car} className="rounded-[var(--radius-brand)] border border-line p-3">
                  <Pill tone={TONE[r.status]}>{t(`PpfBookings.requestStatus.${r.status}`)}</Pill>
                  <p dir="auto" className="mt-1.5 text-[16px] font-extrabold">
                    {r.car}
                  </p>
                  <p className="text-[14px] text-ink-2">{t("Slots.requestLine", { name: isolate(r.salesName), date: short(r.date) })}</p>
                  {r.decisionNote && (
                    <p dir="auto" className="mt-1.5 rounded-[8px] bg-sand px-2.5 py-1.5 text-[14px]">
                      {r.decisionNote}
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
