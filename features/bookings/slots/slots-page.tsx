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
import type { SlotsView } from "@/lib/api/types";
import { qatarDay } from "@/lib/format";
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
 * The salespeople's read-only view of the PPF calendar, protected by a shared
 * PIN. `null` = not known yet (the hint cookie cannot be read on the server).
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
  const [thisMonth] = useState(() => monthOf(qatarDay(new Date())));
  const [month, setMonth] = useState(thisMonth);
  const [selected, setSelected] = useState<string | null>(null);
  /** null = not chosen yet: open on wide screens, closed on phones */
  const [panel, setPanel] = useState<boolean | null>(null);
  const [requesting, setRequesting] = useState(false);
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
    retry: false,
  });

  const data = view.data;
  const info = selected ? data?.days.find((d) => d.date === selected) : undefined;
  const fullCar = selected ? data?.bookings.find((b) => b.type === "FULL" && b.receiveDate === selected) : undefined;
  const canRequest = info?.state === "FULL" && data !== undefined && info.date >= data.today;
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
                  <p className="mt-2 text-[15px] font-semibold text-ink-2">{t("Slots.dayFull")}</p>
                  {fullCar && (
                    <p dir="auto" className="text-[17px] font-extrabold">
                      {fullCar.car}
                    </p>
                  )}
                  {canRequest && (
                    <Button size="touch" className="mt-3 w-full sm:w-auto" onClick={() => setRequesting(true)}>
                      {t("Slots.requestLight")}
                    </Button>
                  )}
                </>
              )}
              {info.lightCount > 0 && <p className="mt-2 text-[14px] text-ink-2">{t("Calendar.light", { count: info.lightCount })}</p>}
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
