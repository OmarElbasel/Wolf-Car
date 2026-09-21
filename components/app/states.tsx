"use client";

import { AlertTriangle, Inbox, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PermissionKey } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { msgKey } from "@/lib/i18n/keys";

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

/** Friendly state for a page the signed-in user has no permission for (the API would refuse anyway). */
export function NoAccess({ permission }: { permission: PermissionKey }) {
  const t = useTranslations("Permissions");
  return (
    <div role="alert" className="grid place-items-center gap-3 rounded-[var(--radius-brand-lg)] border border-dashed border-line px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-sand">
        <Lock className="size-5 text-ink-2" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="max-w-md">
        <p className="text-lg font-extrabold">{t("noAccessTitle")}</p>
        <p className="mt-1 text-[15px] text-ink-2">{t("noAccessBody", { permission: t(`labels.${msgKey(permission)}`) })}</p>
      </div>
    </div>
  );
}
