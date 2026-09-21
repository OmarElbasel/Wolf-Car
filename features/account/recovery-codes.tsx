"use client";

import { Download, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/app/copy-button";
import { Button } from "@/components/ui/button";
import { qatarDay } from "@/lib/format";

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * The one-time display of recovery codes: copy, download as .txt, and an
 * explicit "I've saved them" to continue (the codes are never shown again).
 */
export function RecoveryCodes({ codes, username, onAcknowledge }: { codes: string[]; username: string; onAcknowledge: () => void }) {
  const t = useTranslations("Account.twoFactor");
  const file = [t("fileTitle", { username }), qatarDay(new Date()), "", ...codes, "", t("fileNote"), ""].join("\n");
  return (
    <div className="grid gap-4">
      <p className="flex gap-2 rounded-[var(--radius-brand)] bg-warning-soft p-3 text-[15px] text-warning">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" strokeWidth={1.8} />
        <span>{t("recoveryBody")}</span>
      </p>
      <ol dir="ltr" className="grid grid-cols-2 gap-2 rounded-[var(--radius-brand)] bg-sand p-3" data-testid="recovery-codes">
        {codes.map((code) => (
          <li
            key={code}
            className="rounded-[8px] border border-line bg-surface px-2 py-2 text-center font-mono text-[15px] font-bold tracking-wide select-all"
          >
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={codes.join("\n")} label={t("copyAll")} />
        <Button variant="outline" size="sm" onClick={() => downloadText(`wolfcar-recovery-codes-${username}.txt`, file)}>
          <Download aria-hidden="true" />
          {t("download")}
        </Button>
      </div>
      <div className="flex justify-end border-t border-line pt-4">
        <Button onClick={onAcknowledge}>{t("acknowledge")}</Button>
      </div>
    </div>
  );
}
