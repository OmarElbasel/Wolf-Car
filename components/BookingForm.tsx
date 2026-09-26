"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Wrap, SectionHead, buttonClass } from "./Button";
import { Icon } from "./Icon";
import { getBranchList, bookingMessage, waLink, type BranchId } from "@/lib/branches";
import { getBookingServices } from "@/lib/content";

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
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
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
        onChange={() => onChange(value)}
        className="peer pointer-events-none absolute opacity-0"
      />
      <label
        htmlFor={`${name}-${value}`}
        className="inline-flex min-h-[44px] cursor-pointer items-center rounded-[var(--radius-brand)] border-[1.5px] border-line px-3.5 text-[15px] font-semibold transition-colors peer-checked:border-charcoal peer-checked:bg-charcoal peer-checked:text-white dark:peer-checked:border-accent dark:peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-ink"
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
  const placeBranch = t("placeBranch");
  const placeHome = t("placeHome");
  const places = [placeBranch, placeHome];

  const [branch, setBranch] = useState<BranchId>("binomran");
  const [service, setService] = useState(bookingServices[0].value);
  const [place, setPlace] = useState(places[0]);

  useEffect(() => {
    const onBook = (e: Event) => setPlace((e as CustomEvent<Place>).detail === "home" ? placeHome : placeBranch);
    window.addEventListener(BOOK_EVENT, onBook);
    return () => window.removeEventListener(BOOK_EVENT, onBook);
  }, [placeBranch, placeHome]);

  return (
    <section id="book" className="scroll-mt-16 py-14 lg:py-20">
      <Wrap className="max-w-[860px]!">
        <SectionHead label={t("label")} title={t("title")} body={t("body")} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            window.open(
              waLink(locale, branch, bookingMessage(locale, branch, service, place)),
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
                key={s.value}
                name="svc"
                value={s.value}
                label={s.label}
                checked={service === s.value}
                onChange={setService}
              />
            ))}
          </Row>
          <Row label={t("placeLabel")} last>
            {places.map((p) => (
              <Choice
                key={p}
                name="where"
                value={p}
                label={p}
                checked={place === p}
                onChange={setPlace}
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
