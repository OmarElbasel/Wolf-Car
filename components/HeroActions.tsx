"use client";

import { CalendarCheck, ChevronRight, House, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { openBooking } from "./BookingForm";
import { useContact } from "./ContactProvider";

/**
 * The hero's three booking entry points. Appointment and home service open the
 * booking form with the place preselected (plain #book links until hydration);
 * breakdown goes straight to the branch picker and WhatsApp, because a
 * stranded driver should not fill a form.
 */
export function HeroActions() {
  const t = useTranslations("Hero");
  const { ask } = useContact();

  const book = (place: "branch" | "home") => (e: MouseEvent) => {
    e.preventDefault();
    openBooking(place);
  };

  return (
    <nav aria-label={t("actionsAria")} className="mt-7">
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href="#book"
          onClick={book("branch")}
          className="inline-flex min-h-[56px] items-center justify-center gap-2.5 rounded-[14px] bg-accent px-6 text-[17px] font-extrabold text-white transition-colors hover:bg-accent-dark"
        >
          <CalendarCheck className="size-5" aria-hidden="true" strokeWidth={2.1} />
          {t("bookTitle")}
        </a>
        <a
          href="#book"
          onClick={book("home")}
          className="inline-flex min-h-[56px] items-center justify-center gap-2.5 rounded-[14px] border border-white/20 bg-white/[0.07] px-6 text-[17px] font-bold text-white backdrop-blur-md transition-colors hover:border-white/40 hover:bg-white/[0.12]"
        >
          <House className="size-5" aria-hidden="true" strokeWidth={2} />
          {t("homeTitle")}
        </a>
      </div>
      <button
        type="button"
        onClick={() => ask({ kind: "wa", message: t("breakdownMessage") })}
        className="group mt-4 inline-flex min-h-11 items-center gap-2.5 text-start text-[15px] font-bold text-white/85 transition-colors hover:text-white"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-brand">
          <Truck className="size-[18px]" aria-hidden="true" strokeWidth={2} />
        </span>
        <span>
          {t("breakdownTitle")} <span className="hidden font-semibold text-white/55 sm:inline">· {t("breakdownBody")}</span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-white/55 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
          aria-hidden="true"
          strokeWidth={2.4}
        />
      </button>
    </nav>
  );
}
