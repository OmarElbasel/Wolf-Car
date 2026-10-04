"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/app/badges";
import { Field } from "@/components/app/field";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isolate } from "@/features/admin/shared/ui";
import { api } from "@/lib/api/client";
import type { LightJobRequest, RequestStatus } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { formatDateTime } from "@/lib/format";
import { DECISION_NOTE_MAX } from "@/shared/validation";
import { formatDay } from "../shared/dates";
import { fetchRequests, ppfKeys } from "./queries";

const TONE: Record<RequestStatus, "warning" | "success" | "neutral"> = { PENDING: "warning", APPROVED: "success", REJECTED: "neutral" };

/** Light-job requests from the sales page, newest first. */
export function RequestsInbox({ canManage }: { canManage: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ppfKeys.requests, queryFn: fetchRequests, refetchInterval: 60_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<LightJobRequest | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** A refusal (already answered, day closed) also refreshes, so the list shows what really happened. */
  const decide = async (request: LightJobRequest, verb: "approve" | "reject", json: Record<string, string>) => {
    setBusy(request.id);
    setError(null);
    try {
      await api(`/ppf/requests/${request.id}/${verb}`, { method: "POST", json });
      toast.success(t(verb === "approve" ? "PpfBookings.approved" : "PpfBookings.rejected"));
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      await queryClient.invalidateQueries({ queryKey: ppfKeys.all });
      setBusy(null);
    }
  };

  if (requests.isPending) return <LoadingRows rows={3} className="h-28" />;
  if (requests.isError) return <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />;
  if (requests.data.items.length === 0) return <EmptyState title={t("PpfBookings.requestsEmpty")} />;

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      <ul className="grid gap-3 lg:grid-cols-2">
        {requests.data.items.map((r) => (
          <li key={r.id}>
            <article aria-label={r.car} className="h-full rounded-[var(--radius-brand)] border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Pill tone={TONE[r.status]}>{t(`PpfBookings.requestStatus.${r.status}`)}</Pill>
                <time dateTime={r.createdAt} className="text-[13px] text-muted">
                  {formatDateTime(r.createdAt, locale)}
                </time>
              </div>
              <p dir="auto" className="mt-2 text-[17px] font-extrabold">
                {r.car}
              </p>
              <p className="text-[14px] font-semibold text-ink-2">
                {t("PpfBookings.requestFor", { name: isolate(r.salesName), date: formatDay(r.date, locale, "short") })}
              </p>
              <p className="mt-1 text-[15px] text-ink-2">
                <span dir="auto">{r.ownerName}</span>
                {r.phone && (
                  <>
                    {" · "}
                    <span dir="ltr">{r.phone}</span>
                  </>
                )}
              </p>
              <p dir="auto" className="mt-1 text-[15px] whitespace-pre-line">
                {r.note}
              </p>
              {r.decisionNote && (
                <p dir="auto" className="mt-2 rounded-[8px] bg-sand px-2.5 py-1.5 text-[14px] text-ink-2">
                  {r.decisionNote}
                </p>
              )}
              {canManage && r.status === "PENDING" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy === r.id} onClick={() => void decide(r, "approve", {})}>
                    <Check aria-hidden="true" />
                    {t("PpfBookings.approve")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => {
                      setReason("");
                      setRejecting(r);
                    }}
                  >
                    <X aria-hidden="true" />
                    {t("PpfBookings.reject")}
                  </Button>
                </div>
              )}
            </article>
          </li>
        ))}
      </ul>

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent closeLabel={t("Common.close")} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("PpfBookings.rejectTitle")}</DialogTitle>
            <DialogDescription dir="auto">{rejecting?.car}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!rejecting) return;
              void decide(rejecting, "reject", { decisionNote: reason }).then(() => setRejecting(null));
            }}
          >
            <Field label={t("PpfBookings.rejectReason")} optional>
              <Textarea dir="auto" rows={3} maxLength={DECISION_NOTE_MAX} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
                {t("Common.cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={busy !== null}>
                {t("PpfBookings.reject")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
