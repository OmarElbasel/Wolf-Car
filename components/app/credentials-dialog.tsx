"use client";

import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/app/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { IssuedCredentials } from "@/lib/api/types";

function Secret({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-brand)] border border-line bg-sand px-3 py-2">
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-muted">{label}</p>
        <p dir="ltr" className="truncate text-start font-mono text-[15px] font-bold select-all" data-testid="secret">
          {value}
        </p>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

/**
 * Shows generated passwords exactly once. Closing requires an explicit
 * acknowledgement; the values are never stored anywhere by the app.
 */
export function CredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: IssuedCredentials[] | null;
  onClose: () => void;
}) {
  const t = useTranslations("Common");
  const all = (credentials ?? [])
    .map((c) =>
      [
        `${t("credentials.username")}: ${c.username}`,
        c.password && `${t("credentials.password")}: ${c.password}`,
        c.showroomPassword && `${t("credentials.showroomPassword")}: ${c.showroomPassword}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
  return (
    <Dialog open={credentials !== null} onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        className="sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{t("credentials.title")}</DialogTitle>
          <DialogDescription className="flex gap-2 rounded-[var(--radius-brand)] bg-warning-soft p-3 text-warning">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span>{t("credentials.warning")}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          {credentials?.map((c) => (
            <section key={c.userId} className="grid gap-2" aria-label={c.displayName}>
              <p className="font-bold">{t("credentials.for", { name: c.displayName, role: t(`roles.${c.role}`) })}</p>
              <Secret label={t("credentials.username")} value={c.username} />
              {c.password && <Secret label={t("credentials.password")} value={c.password} />}
              {c.showroomPassword && <Secret label={t("credentials.showroomPassword")} value={c.showroomPassword} />}
            </section>
          ))}
        </div>
        <DialogFooter>
          <CopyButton value={all} label={t("credentials.copyAll")} />
          <Button onClick={onClose}>{t("credentials.acknowledge")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
