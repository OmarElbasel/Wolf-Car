"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Wrap, SectionHead, buttonClass } from "./Button";
import { Icon } from "./Icon";
import { getBranchList, bookingMessage, waLink, type BranchId } from "@/lib/branches";
import { bookingServiceAvailable, getBookingServices, type BookingServiceId } from "@/lib/content";

type Place = "branch" | "home";
const BOOK_EVENT = "wolfcar:book";

/**
 * Scrolls to the booking form with the service location preselected. Used by
 * the hero's "book an appointment" / "book home service" actions.
 */
export function openBooking(place: Place) {
  window.dispatchEvent(new CustomEvent<Place>(BOOK_EVENT, { detail: place }));
  const form = document.getElementById("book");
  if (!form) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  form.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  history.replaceState(null, "", "#book");
}

function Choice({
  name,
  value,
  label,
  checked,
  disabled = false,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <span className="relative">
      <input
        type="radio"
        name={name}
        id={`${name}-${value}`}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="peer pointer-events-none absolute opacity-0"
      />
      <label
        htmlFor={`${name}-${value}`}
        className="inline-flex min-h-[44px] cursor-pointer items-center rounded-[var(--radius-brand)] border-[1.5px] border-line px-3.5 text-[15px] font-semibold transition-colors peer-checked:border-charcoal peer-checked:bg-charcoal peer-checked:text-white dark:peer-checked:border-accent dark:peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-ink peer-disabled:cursor-not-allowed peer-disabled:border-dashed peer-disabled:text-muted peer-disabled:line-through"
      >
        {label}
      </label>
    </span>
  );
}

function Row({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid grid-cols-[78px_1fr] items-center gap-2.5 py-3.5 md:grid-cols-[110px_1fr] ${
        last ? "" : "border-b border-line"
      }`}
    >
      <div className="text-[15px] font-bold text-ink-2">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function BookingForm() {
  const locale = useLocale();
  const t = useTranslations("Booking");
  const branchList = getBranchList(locale);
  const bookingServices = getBookingServices(locale);
  const places: { id: Place; label: string }[] = [
    { id: "branch", label: t("placeBranch") },
    { id: "home", label: t("placeHome") },
  ];

  const [branch, setBranch] = useState<BranchId>("binomran");
  const [picked, setService] = useState<BookingServiceId>(bookingServices[0].id);
  const [place, setPlace] = useState<Place>("branch");
  // PPF is not done at home, and Al Gharrafa does neither PPF nor tinting: a
  // choice the new branch or place rules out falls back to the first that fits
  const available = (id: BookingServiceId) => bookingServiceAvailable(id, branch, place);
  const service = bookingServices.find((s) => s.id === picked && available(s.id)) ?? bookingServices.find((s) => available(s.id))!;

  useEffect(() => {
    const onBook = (e: Event) => setPlace((e as CustomEvent<Place>).detail === "home" ? "home" : "branch");
    window.addEventListener(BOOK_EVENT, onBook);
    return () => window.removeEventListener(BOOK_EVENT, onBook);
  }, []);

  return (
    <section id="book" className="scroll-mt-16 py-14 lg:py-20">
      <Wrap className="max-w-[860px]!">
        <SectionHead label={t("label")} title={t("title")} body={t("body")} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            window.open(
              waLink(locale, branch, bookingMessage(locale, branch, service.value, places.find((p) => p.id === place)!.label)),
              "_blank",
              "noopener",
            );
          }}
          className="rounded-[var(--radius-brand-lg)] border border-line px-5 pt-2 pb-5"
        >
          <Row label={t("branchLabel")}>
            {branchList.map((b) => (
              <Choice
                key={b.id}
                name="branch"
                value={b.id}
                label={b.short}
                checked={branch === b.id}
                onChange={(v) => setBranch(v as BranchId)}
              />
            ))}
          </Row>
          <Row label={t("serviceLabel")}>
            {bookingServices.map((s) => (
              <Choice
                key={s.id}
                name="svc"
                value={s.id}
                label={s.label}
                checked={service.id === s.id}
                disabled={!available(s.id)}
                onChange={(v) => setService(v as BookingServiceId)}
              />
            ))}
          </Row>
          <Row label={t("placeLabel")} last>
            {places.map((p) => (
              <Choice
                key={p.id}
                name="where"
                value={p.id}
                label={p.label}
                checked={place === p.id}
                onChange={(v) => setPlace(v as Place)}
              />
            ))}
          </Row>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1.5">
            <small className="text-sm text-muted">{t("homeFeeNote")}</small>
            <button type="submit" className={buttonClass("primary")}>
              <Icon name="wa" />
              {t("submit")}
            </button>
          </div>
        </form>
      </Wrap>
    </section>
  );
}
