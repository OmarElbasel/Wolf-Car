"use client";

import { CalendarCheck, ChevronRight, House, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { openBooking } from "./BookingForm";
import { useContact } from "./ContactProvider";

/**
 * The hero's three booking entry points. Appointment and home service open the
 * booking form with the place preselected; breakdown goes straight to the
 * branch picker and WhatsApp, because a stranded driver should not fill a form.
 */
export function HeroActions() {
  const t = useTranslations("Hero");
  const { ask } = useContact();

  return (
    <nav aria-label={t("actionsAria")} className="mt-6 grid gap-2.5">
      <Action
        primary
        icon={<CalendarCheck className="size-6" strokeWidth={1.9} />}
        title={t("bookTitle")}
        body={t("bookBody")}
        href="#book"
        onClick={() => openBooking("branch")}
      />
      <Action
        icon={<House className="size-6" strokeWidth={1.9} />}
        title={t("homeTitle")}
        body={t("homeBody")}
        href="#book"
        onClick={() => openBooking("home")}
      />
      <Action
        icon={<Truck className="size-6" strokeWidth={1.9} />}
        title={t("breakdownTitle")}
        body={t("breakdownBody")}
        onClick={() => ask({ kind: "wa", message: t("breakdownMessage") })}
      />
    </nav>
  );
}

function Action({
  icon,
  title,
  body,
  href,
  onClick,
  primary = false,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  /** in-page target, so the link still works before hydration */
  href?: string;
  onClick: () => void;
  primary?: boolean;
}) {
  const className = `group flex min-h-[72px] w-full items-center gap-3.5 rounded-[var(--radius-brand-lg)] px-3.5 py-3 text-start transition-colors ${
    primary
      ? "bg-accent text-white hover:bg-accent-dark"
      : "border border-line bg-surface/90 text-ink hover:border-ink dark:bg-surface/70"
  }`;
  const content = (
    <>
      <span
        aria-hidden="true"
        className={`grid size-12 shrink-0 place-items-center rounded-[var(--radius-brand)] ${
          primary ? "bg-white/15 text-white" : "bg-sand text-accent-ink"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 leading-snug">
        <b className="block text-[17px] font-extrabold">{title}</b>
        <small className={`block text-[14px] ${primary ? "text-white/80" : "text-muted"}`}>{body}</small>
      </span>
      <ChevronRight
        aria-hidden="true"
        className={`size-5 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5 ${
          primary ? "text-white" : "text-muted"
        }`}
        strokeWidth={2.2}
      />
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
      >
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}
