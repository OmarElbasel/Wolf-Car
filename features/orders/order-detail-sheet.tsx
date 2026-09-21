"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, CheckCircle2, FileDown, Lock, Pencil } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { OrderStatusBadge } from "@/components/app/badges";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ErrorState, LoadingRows } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/auth-provider";
import { isolate } from "@/features/products/bidi";
import { api, ApiError } from "@/lib/api/client";
import type { OrderDetail } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { formatDateTime, formatMoney } from "@/lib/format";
import { OrderEditor } from "./order-editor";
import { fetchOrder, orderKeys } from "./queries";
import { downloadReceipt } from "./receipt";

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-[13px] font-bold text-muted">{label}</dt>
      <dd className="min-w-0 text-[15px] break-words">{children}</dd>
    </div>
  );
}

function ReceiptButton({ order, lang, disabled, describedBy }: { order: OrderDetail; lang: "ar" | "en"; disabled: boolean; describedBy?: string }) {
  const t = useTranslations("Orders");
  const message = useErrorMessage();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={disabled || busy}
      aria-describedby={describedBy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadReceipt(order, lang);
        } catch (error) {
          toast.error(message(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileDown className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
      {busy ? t("downloading") : lang === "ar" ? t("receiptAr") : t("receiptEn")}
    </Button>
  );
}

function OrderDetailBody({ id }: { id: string }) {
  const t = useTranslations("Orders");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const { user, can } = useAuth();
  const order = useQuery({ queryKey: orderKeys.detail(id), queryFn: () => fetchOrder(id) });
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<"confirm" | "cancel" | null>(null);

  if (order.isPending || order.isError) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>{order.isPending ? tc("loading") : t("title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("title")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="pb-6">
          {order.isPending ? <LoadingRows rows={5} className="h-12" /> : <ErrorState error={order.error} onRetry={() => void order.refetch()} />}
        </SheetBody>
      </>
    );
  }

  const o = order.data;
  const isAdmin = user?.role === "SUPER_ADMIN";
  const pending = o.status === "PENDING";
  // gated by permission AND state; the Super Admin may override the "pending only" rule (the API allows it)
  const canEdit = can("order.update") && (pending || isAdmin);
  const canConfirm = can("order.confirm") && pending;
  const canCancel = can("order.cancel") && (pending || (isAdmin && o.status === "CONFIRMED"));
  const canReceipt = can("order.receipt.download");
  const locked = o.status === "CONFIRMED" && !canEdit && !canCancel;
  const branch = locale === "ar" ? o.branch.nameAr : o.branch.name;

  const settle = (updated: OrderDetail) => {
    queryClient.setQueryData(orderKeys.detail(id), updated);
    void queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
  };
  const fail = (error: unknown) => {
    toast.error(message(error));
    if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
      // someone else changed it (e.g. ORDER_NOT_PENDING): show the current state
      setDialog(null);
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    }
  };
  const act = (action: "confirm" | "cancel") => async () => {
    try {
      const updated = await api<OrderDetail>(`/orders/${id}/${action}`, { method: "POST" });
      settle(updated);
      toast.success(action === "confirm" ? t("confirmed", { code: o.code }) : t("cancelled", { code: o.code }));
    } catch (error) {
      fail(error);
      throw error;
    }
  };

  const header = (
    <SheetHeader>
      <div className="flex flex-wrap items-center gap-2">
        <SheetTitle>{t("detailTitle", { code: isolate(o.code) })}</SheetTitle>
        <OrderStatusBadge status={o.status} />
      </div>
      <SheetDescription>{t("placedLine", { date: formatDateTime(o.createdAt, locale), name: isolate(o.createdBy.displayName) })}</SheetDescription>
    </SheetHeader>
  );

  if (editing) {
    return (
      <>
        {header}
        <OrderEditor order={o} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} onError={fail} />
      </>
    );
  }

  const receiptHintId = `receipt-hint-${o.id}`;
  return (
    <>
      {header}
      <SheetBody className="grid content-start gap-5 pb-4">
        {locked && (
          <p className="flex items-center gap-2 rounded-[var(--radius-brand)] bg-sand px-3 py-2.5 text-sm font-semibold text-ink-2">
            <Lock className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {t("lockedNote")}
          </p>
        )}

        <div className="grid gap-3 rounded-[var(--radius-brand-lg)] border border-line p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Meta label={t("customer")}>
              <span dir="auto" className="font-bold">
                {o.customerName}
              </span>
            </Meta>
            <Meta label={tc("branch")}>{branch}</Meta>
            <Meta label={t("placedBy")}>
              <span dir="auto">{o.createdBy.displayName}</span>
            </Meta>
            <Meta label={t("placedAt")}>
              <time dateTime={o.createdAt}>{formatDateTime(o.createdAt, locale)}</time>
            </Meta>
          </dl>
          {o.confirmedBy && o.confirmedAt && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span className="font-bold">{t("confirmedBy", { name: isolate(o.confirmedBy.displayName) })}</span>
              <time dateTime={o.confirmedAt} className="text-ink-2">
                {formatDateTime(o.confirmedAt, locale)}
              </time>
            </p>
          )}
          {o.cancelledBy && o.cancelledAt && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-danger">
              <Ban className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span className="font-bold">{t("cancelledBy", { name: isolate(o.cancelledBy.displayName) })}</span>
              <time dateTime={o.cancelledAt} className="text-ink-2">
                {formatDateTime(o.cancelledAt, locale)}
              </time>
            </p>
          )}
        </div>

        <section aria-labelledby={`lines-${o.id}`} className="grid gap-2">
          <h3 id={`lines-${o.id}`} className="text-sm font-bold text-ink-2">
            {t("items")} · {t("lines", { count: o.items.length })}
          </h3>
          <ul className="divide-y divide-line rounded-[var(--radius-brand-lg)] border border-line">
            {o.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <Image
                  src={item.thumbUrl}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  className="size-12 shrink-0 rounded-[var(--radius-brand)] border border-line bg-sand object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="w-fit max-w-full truncate font-bold">
                    {item.productName}
                  </p>
                  {item.barcode && (
                    <p className="truncate text-[13px] text-muted">
                      <span dir="ltr" className="font-mono">
                        {item.barcode}
                      </span>
                    </p>
                  )}
                  <p className="text-[13px] text-ink-2">
                    {t("quantity")}{" "}
                    <b dir="ltr" className="tabular-nums">
                      {item.quantity}
                    </b>
                    {" · "}
                    {t("unitPrice")}{" "}
                    <span className="tabular-nums">
                      {formatMoney(item.unitPrice, locale)}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 text-end">
                  <span className="sr-only">{t("lineTotal")} </span>
                  <span className="font-bold tabular-nums">
                    {formatMoney(item.lineTotal, locale)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center justify-between gap-3 px-1 text-[17px] font-extrabold">
            <span>{t("grandTotal")}</span>
            <span className="tabular-nums">
              {formatMoney(o.total, locale)}
            </span>
          </p>
        </section>

        {canReceipt && (
          <section aria-labelledby={`receipt-${o.id}`} className="grid gap-2">
            <h3 id={`receipt-${o.id}`} className="text-sm font-bold text-ink-2">
              {t("receipt")}
            </h3>
            <div className="flex flex-wrap gap-2">
              <ReceiptButton order={o} lang="ar" disabled={o.status !== "CONFIRMED"} describedBy={o.status !== "CONFIRMED" ? receiptHintId : undefined} />
              <ReceiptButton order={o} lang="en" disabled={o.status !== "CONFIRMED"} describedBy={o.status !== "CONFIRMED" ? receiptHintId : undefined} />
            </div>
            {o.status !== "CONFIRMED" && (
              <p id={receiptHintId} className="text-[13px] text-muted">
                {t("receiptOnlyConfirmed")}
              </p>
            )}
          </section>
        )}
      </SheetBody>

      {(canEdit || canCancel || canConfirm) && (
        <SheetFooter className="flex-wrap">
          {canEdit && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
              {t("edit")}
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive-outline" onClick={() => setDialog("cancel")}>
              <Ban className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
              {t("cancel")}
            </Button>
          )}
          {canConfirm && (
            <Button onClick={() => setDialog("confirm")}>
              <Check className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
              {t("confirm")}
            </Button>
          )}
        </SheetFooter>
      )}

      <ConfirmDialog
        open={dialog === "confirm"}
        onOpenChange={(open) => setDialog(open ? "confirm" : null)}
        title={t("confirmTitle", { code: isolate(o.code) })}
        body={t("confirmBody")}
        confirmLabel={t("confirm")}
        onConfirm={act("confirm")}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => setDialog(open ? "cancel" : null)}
        title={t("cancelTitle", { code: isolate(o.code) })}
        body={t("cancelBody")}
        confirmLabel={t("cancel")}
        cancelLabel={t("keep")}
        destructive
        onConfirm={act("cancel")}
      />
    </>
  );
}

/** Side sheet with one order: details, line items and the actions this user may take. */
export function OrderDetailSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const tc = useTranslations("Common");
  // keep showing the last order while the sheet animates out
  const [shownId, setShownId] = useState(orderId);
  if (orderId !== null && orderId !== shownId) setShownId(orderId);
  return (
    <Sheet
      open={orderId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="end" closeLabel={tc("close")} className="sm:max-w-xl">
        {shownId && <OrderDetailBody key={shownId} id={shownId} />}
      </SheetContent>
    </Sheet>
  );
}
