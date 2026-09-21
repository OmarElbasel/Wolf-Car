"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getBranchList, telLink, waLink, type BranchId } from "@/lib/branches";

type Intent = { kind: "wa"; message?: string } | { kind: "call" };

interface ContactApi {
  /** Opens the branch picker, then routes to WhatsApp or the dialler. */
  ask: (intent: Intent) => void;
}

const Ctx = createContext<ContactApi | null>(null);

export function useContact(): ContactApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useContact must be used inside <ContactProvider>");
  return ctx;
}

export function ContactProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const t = useTranslations("ContactSheet");
  const branchList = getBranchList(locale);
  const [intent, setIntent] = useState<Intent | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const firstChoice = useRef<HTMLButtonElement | null>(null);

  const ask = useCallback((next: Intent) => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    setIntent(next);
  }, []);

  const close = useCallback(() => {
    setIntent(null);
    restoreFocus.current?.focus();
  }, []);

  useEffect(() => {
    if (!intent) return;
    firstChoice.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [intent, close]);

  const choose = (branch: BranchId) => {
    const current = intent;
    setIntent(null);
    if (!current) return;
    if (current.kind === "call") {
      window.location.assign(telLink(locale, branch));
    } else {
      window.open(waLink(locale, branch, current.message), "_blank", "noopener");
    }
  };

  return (
    <Ctx.Provider value={{ ask }}>
      {children}
      {intent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-heading"
          className="fixed inset-0 z-70 flex items-end justify-center bg-black/45"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-[480px] rounded-t-2xl bg-surface px-5 pt-5 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <h3 id="sheet-heading" className="mb-3 text-lg font-extrabold">
              {t("heading")}
            </h3>
            {branchList.map((b, i) => (
              <button
                key={b.id}
                ref={i === 0 ? firstChoice : undefined}
                type="button"
                onClick={() => choose(b.id)}
                className="mb-2 flex min-h-[58px] w-full items-center justify-between rounded-[var(--radius-brand)] border-[1.5px] border-line px-4 text-start text-base font-bold transition-colors hover:border-ink"
              >
                {b.name}
                <small className="text-sm font-medium text-muted">{b.area}</small>
              </button>
            ))}
            <button
              type="button"
              onClick={close}
              className="min-h-[46px] w-full font-semibold text-muted"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
