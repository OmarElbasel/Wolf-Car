"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { BrandMark } from "@/components/app/brand";
import { Pill } from "@/components/app/badges";
import { ErrorState } from "@/components/app/states";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useWideLayout } from "@/features/admin/shared/ui";
import { ApiError } from "@/lib/api/client";
import type { PpfBookingType, SlotsView } from "@/lib/api/types";
import { qatarDay } from "@/lib/format";
import { PPF_MAX_FULL_PER_DAY } from "@/shared/validation";
import { addMonths, formatDay, monthOf, monthRange } from "../shared/dates";
import { MonthCalendar } from "../shared/month-calendar";
import { hasSlotsHint, slotsApi } from "./api";
import { PinScreen } from "./pin-screen";
import { RequestDialog } from "./request-form";
import { SidePanel } from "./side-panel";

const HEADER_H = "66px";
const STATE_TONE = { OPEN: "success", FULL: "danger", CLOSED: "neutral" } as const;
const noop = () => () => undefined;

/**
 * The salespeople's view of the PPF calendar, protected by a shared PIN. They
 * book nothing themselves: they send requests, which wait for the call center.
 * `null` = not known yet (the hint cookie cannot be read on the server).
 */
export function SlotsPage() {
  const queryClient = useQueryClient();
  const hinted = useSyncExternalStore<boolean | null>(noop, hasSlotsHint, () => null);
  /** what this tab learned since loading: a fresh unlock, or the API refusing the cookie */
  const [known, setKnown] = useState<boolean | null>(null);
  const unlocked = known ?? hinted;

  if (unlocked === null) {
    return (
      <div className="grid min-h-dvh place-items-center bg-sand" role="status">
        <Skeleton className="h-1.5 w-40 rounded-full" />
      </div>
    );
  }
  if (!unlocked) {
    return (
      <PinScreen
        onUnlocked={() => {
          // never show what an earlier PIN could see
          queryClient.removeQueries({ queryKey: ["slots"] });
          setKnown(true);
        }}
      />
    );
  }
  return <Slots onLocked={() => setKnown(false)} />;
}

function Slots({ onLocked }: { onLocked: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const wide = useWideLayout("(min-width: 1024px)");
  // read on every render: a page left open over the end of a month moves on by itself
  const thisMonth = monthOf(qatarDay(new Date()));
  const [picked, setMonth] = useState(thisMonth);
  const month = picked < thisMonth ? thisMonth : picked;
  const [selected, setSelected] = useState<string | null>(null);
  /** null = not chosen yet: open on wide screens, closed on phones */
  const [panel, setPanel] = useState<boolean | null>(null);
  const [requesting, setRequesting] = useState(false);
  /** kept while the dialog closes, so its title does not change on the way out */
  const [requestType, setRequestType] = useState<PpfBookingType>("LIGHT");
  const panelOpen = panel ?? wide;

  const view = useQuery({
    queryKey: ["slots", month],
    queryFn: async () => {
      try {
        return await slotsApi<SlotsView>("", { query: monthRange(month) });
      } catch (e) {
        // the PIN was changed, or the 90 days are over
        if (e instanceof ApiError && e.status === 401) onLocked();
        throw e;
      }
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const data = view.data;
  const info = selected ? data?.days.find((d) => d.date === selected) : undefined;
  const fullCars = data?.bookings.filter((b) => b.type === "FULL" && b.receiveDate === selected) ?? [];
  const waiting = data?.requests.filter((r) => r.status === "PENDING" && r.date === selected) ?? [];
  const canRequest = info !== undefined && data !== undefined && info.state !== "CLOSED" && info.date >= data.today;
  const fullRoom = info !== undefined && info.fullCount < PPF_MAX_FULL_PER_DAY;
  const ask = (type: PpfBookingType) => {
    setRequestType(type);
    setRequesting(true);
  };
  const panelBody = <SidePanel bookings={data?.bookings ?? []} requests={data?.requests ?? []} />;
  const PanelIcon = panelOpen ? PanelRightClose : PanelRightOpen;

  return (
    <div className="min-h-dvh bg-sand">
      <header className="sticky top-0 z-30 border-b border-line bg-surface" style={{ height: HEADER_H }}>
        <div className="flex h-full items-center justify-between gap-2 px-4 lg:px-6">
          <BrandMark name={t("Brand.name")} sub={`${t("Slots.title")} · ${t("Slots.branch")}`} />
          <div className="flex shrink-0 items-center gap-1">
            <LocaleSwitcher className="px-2" />
            <ThemeToggle />
            <Button
              variant="outline"
              size="icon"
              className="ms-1"
              aria-expanded={panelOpen}
              aria-label={t(panelOpen ? "Slots.hidePanel" : "Slots.showPanel")}
              onClick={() => setPanel(!panelOpen)}
            >
              <PanelIcon className="rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <div className={wide && panelOpen ? "grid grid-cols-[minmax(0,1fr)_380px]" : undefined}>
        <main className="mx-auto w-full max-w-3xl px-4 py-5 lg:px-6">
          <h1 className="sr-only">{`${t("Slots.title")} · ${t("Slots.branch")}`}</h1>
          {view.isError && data && (
            <p role="alert" className="mb-3 rounded-[var(--radius-brand)] bg-warning-soft px-3 py-2.5 text-[15px] font-semibold text-warning">
              {t("Slots.stale")}
            </p>
          )}
          {view.isError && !data ? (
            <ErrorState error={view.error} onRetry={() => void view.refetch()} />
          ) : (
            <div className="rounded-[var(--radius-brand-lg)] border border-line bg-surface p-3 sm:p-4">
              <MonthCalendar
                month={month}
                days={data?.days}
                today={data?.today}
                selected={selected}
                onSelect={setSelected}
                onMonthChange={(next) => {
                  setMonth(next);
                  setSelected(null);
                }}
                minMonth={thisMonth}
                maxMonth={addMonths(thisMonth, 12)}
              />
            </div>
          )}

          {selected && info && (
            <section aria-label={formatDay(selected, locale)} className="mt-4 rounded-[var(--radius-brand-lg)] border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg leading-tight font-extrabold">{formatDay(selected, locale)}</h2>
                <Pill tone={STATE_TONE[info.state]}>{t(`Calendar.states.${info.state}`)}</Pill>
              </div>
              {info.state === "OPEN" && <p className="mt-2 text-[15px] text-ink-2">{t("Slots.dayOpen")}</p>}
              {info.state === "CLOSED" && (
                <>
                  <p className="mt-2 text-[15px] font-semibold text-ink-2">{t("Slots.dayClosed")}</p>
                  {info.reason && (
                    <p dir="auto" className="text-[15px] text-ink-2">
                      {info.reason}
                    </p>
                  )}
                </>
              )}
              {info.state === "FULL" && (
                <>
                  <p className="mt-2 text-[15px] font-semibold text-ink-2">{t(fullRoom ? "Slots.dayFull" : "Slots.dayFullTwo")}</p>
                  {fullCars.map((b) => (
                    <p key={b.id} dir="auto" className="text-[17px] font-extrabold">
                      {b.car}
                    </p>
                  ))}
                </>
              )}
              {info.lightCount > 0 && <p className="mt-2 text-[14px] text-ink-2">{t("Calendar.light", { count: info.lightCount })}</p>}
              {waiting.length > 0 && (
                <div className="mt-3 rounded-[var(--radius-brand)] bg-warning-soft px-3 py-2.5">
                  <p className="text-[14px] font-extrabold text-warning">{t("Slots.waiting")}</p>
                  <ul aria-label={t("Slots.waiting")} className="mt-1 grid gap-1">
                    {waiting.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-x-2 text-[15px]">
                        <span dir="auto" className="font-semibold">
                          {r.car}
                        </span>
                        <span className="text-ink-2">{t(`PpfBookings.types.${r.type}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {canRequest && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {fullRoom && (
                    <Button size="touch" onClick={() => ask("FULL")}>
                      {t(info.fullCount === 0 ? "Slots.requestFull" : "Slots.requestSecondFull")}
                    </Button>
                  )}
                  <Button size="touch" variant={fullRoom ? "outline" : "default"} onClick={() => ask("LIGHT")}>
                    {t("Slots.requestLight")}
                  </Button>
                </div>
              )}
            </section>
          )}
        </main>

        {wide && panelOpen && (
          <aside className="border-s border-line bg-surface" aria-label={t("Slots.cars")}>
            <div className="sticky overflow-y-auto" style={{ top: HEADER_H, height: `calc(100dvh - ${HEADER_H})` }}>
              {panelBody}
            </div>
          </aside>
        )}
      </div>

      <Sheet open={!wide && panelOpen} onOpenChange={setPanel}>
        <SheetContent side="bottom" closeLabel={t("Common.close")} className="h-[85dvh] gap-0">
          <SheetHeader>
            <SheetTitle>{t("Slots.cars")}</SheetTitle>
          </SheetHeader>
          <SheetBody className="p-0">{panelBody}</SheetBody>
        </SheetContent>
      </Sheet>

      {selected && (
        <RequestDialog
          date={selected}
          type={requestType}
          second={(info?.fullCount ?? 0) > 0}
          open={requesting}
          onOpenChange={setRequesting}
          onSent={() => {
            setRequesting(false);
            void queryClient.invalidateQueries({ queryKey: ["slots"] });
          }}
        />
      )}
    </div>
  );
}
