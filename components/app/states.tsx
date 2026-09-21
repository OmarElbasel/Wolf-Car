"use client";

import { AlertTriangle, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/lib/api/use-error-message";

export function LoadingRows({ rows = 6, className = "h-14" }: { rows?: number; className?: string }) {
  const t = useTranslations("Common");
  return (
    <div className="grid gap-2" role="status" aria-live="polite">
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`${className} rounded-[var(--radius-brand)]`} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations("Common");
  const message = useErrorMessage();
  return (
    <div role="alert" className="grid place-items-center gap-3 rounded-[var(--radius-brand-lg)] border border-line bg-sand px-6 py-10 text-center">
      <AlertTriangle className="size-7 text-danger" aria-hidden="true" strokeWidth={1.8} />
      <div>
        <p className="font-bold">{t("errorTitle")}</p>
        <p className="text-[15px] text-ink-2">{message(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 rounded-[var(--radius-brand-lg)] border border-dashed border-line px-6 py-12 text-center">
      <Inbox className="size-7 text-muted" aria-hidden="true" strokeWidth={1.8} />
      <div>
        <p className="font-bold">{title}</p>
        {body && <p className="text-[15px] text-ink-2">{body}</p>}
      </div>
      {action}
    </div>
  );
}
