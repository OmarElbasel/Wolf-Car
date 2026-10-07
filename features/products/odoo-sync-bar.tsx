"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api/client";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { productKeys } from "./queries";

export interface OdooRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  byUser: boolean;
  ok: boolean | null;
  error: string | null;
  summary: { imported: number; created: number; updated: number; repriced: number; switchedOff: number; warnings: number } | null;
}

export interface OdooSyncStatus {
  configured: boolean;
  running: boolean;
  everyMinutes: number;
  last: OdooRun | null;
  lastOk: OdooRun | null;
}

const STATUS_KEY = ["odoo", "sync"] as const;

/**
 * Above the product list once Odoo is connected: when the catalogue was last
 * brought up to date, whether that worked, and a way to do it right now.
 */
export function OdooSyncBar() {
  const t = useTranslations("Products.odoo");
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const status = useQuery({ queryKey: STATUS_KEY, queryFn: () => api<OdooSyncStatus>("/odoo/sync"), refetchInterval: 60_000 });
  const sync = useMutation({
    mutationFn: () => api<OdooRun>("/odoo/sync", { method: "POST" }),
    onSuccess: (run) => {
      toast.success(t("done", { created: run.summary?.created ?? 0, updated: run.summary?.updated ?? 0, hidden: run.summary?.switchedOff ?? 0 }));
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
    onError: (error) => toast.error(message(error)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  });

  const data = status.data;
  if (!data?.configured) return null;
  const failed = data.last?.ok === false;
  const busy = sync.isPending || data.running;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-brand)] border border-line bg-surface px-3.5 py-2.5">
      <div className="min-w-0 text-[14px] text-ink-2">
        <p>
          {data.lastOk?.finishedAt
            ? t("lead", { when: formatRelative(data.lastOk.finishedAt, locale), minutes: data.everyMinutes })
            : t("never")}
        </p>
        {failed && (
          <p role="alert" className="font-semibold text-danger">
            {t("failed", { error: data.last?.error ?? "" })}
          </p>
        )}
      </div>
      {can("product.update.price") && (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => sync.mutate()}>
          <RefreshCw className={cn(busy && "animate-spin")} aria-hidden="true" />
          {busy ? t("syncing") : t("now")}
        </Button>
      )}
    </div>
  );
}
