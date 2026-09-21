"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { PermissionInfo, PermissionKey } from "@/lib/api/types";
import { msgKey } from "@/lib/i18n/keys";
import { base } from "@/lib/motion";
import { PERMISSION_GROUPS, type PermissionGroup } from "@/shared/permissions";

/** Catalog grouped in the canonical group order (product, order, admin, account). */
export function groupCatalog(catalog: PermissionInfo[]): { group: PermissionGroup; permissions: PermissionInfo[] }[] {
  return PERMISSION_GROUPS.map((group) => ({ group, permissions: catalog.filter((p) => p.group === group) })).filter(
    (g) => g.permissions.length > 0,
  );
}

/** Same members, any order. */
export function sameSet(a: readonly PermissionKey[], b: readonly PermissionKey[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((k) => set.has(k));
}

/** Warns before closing the tab with unsaved permission changes. */
function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}

/** Sticky "Unsaved changes — Discard / Save" bar shown while a draft differs from the server. */
export function UnsavedBar({ dirty, saving, onSave, onDiscard }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void }) {
  const t = useTranslations();
  useLeaveWarning(dirty);
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {dirty ? t("Permissions.unsaved") : ""}
      </p>
      <AnimatePresence>
        {dirty && (
          <motion.div
            role="region"
            aria-label={t("Permissions.unsaved")}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={base}
            className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-brand-lg)] bg-charcoal px-4 py-3 text-white dark:bg-[#2a2723]"
          >
            <p className="flex items-center gap-2 font-bold">
              <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
              {t("Permissions.unsaved")}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={onDiscard} disabled={saving}>
                {t("Permissions.discard")}
              </Button>
              <Button onClick={onSave} disabled={saving}>
                {saving ? t("Common.saving") : t("Permissions.save")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** "Create products" + the key itself in small monospace. */
export function PermissionLabel({ info, id }: { info: PermissionInfo; id?: string }) {
  const t = useTranslations("Permissions.labels");
  const key = msgKey(info.key);
  return (
    <span className="grid gap-0.5 text-start">
      <span id={id} className="text-[15px] font-bold text-ink">
        {t.has(key) ? t(key) : info.description}
      </span>
      <span className="text-[12px] font-normal text-muted">
        <span dir="ltr" className="font-mono">
          {info.key}
        </span>
      </span>
    </span>
  );
}
