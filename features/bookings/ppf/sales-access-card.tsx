"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Shuffle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { pinField } from "../shared/schemas";
import { fetchSalesAccess, ppfKeys } from "./queries";

const randomPin = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");

/** The link salespeople open, and the shared PIN that protects it. The PIN is shown only while it is being set. */
export function SalesAccessCard({ canManage }: { canManage: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const titleId = useId();
  const access = useQuery({ queryKey: ppfKeys.salesAccess, queryFn: fetchSalesAccess });
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/${locale}/slots`;

  const save = async () => {
    const parsed = pinField.safeParse(pin);
    if (!parsed.success) return setError("pin");
    setSaving(true);
    try {
      await api("/ppf/sales-access/pin", { method: "PUT", json: { pin: parsed.data } });
      toast.success(t("PpfBookings.pinSaved"));
      await queryClient.invalidateQueries({ queryKey: ppfKeys.salesAccess });
      setOpen(false);
    } catch (e) {
      toast.error(message(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={titleId} className="mt-8 rounded-[var(--radius-brand-lg)] border border-line p-4">
      <h2 id={titleId} className="text-lg font-extrabold">
        {t("PpfBookings.salesTitle")}
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">{t("PpfBookings.salesHint")}</p>
      <p dir="ltr" className="mt-3 rounded-[8px] bg-sand px-3 py-2 text-start font-mono text-[14px] break-all select-all">
        {link}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {access.data && <p className="text-[15px] font-semibold">{t(access.data.pinSet ? "PpfBookings.pinSet" : "PpfBookings.pinNotSet")}</p>}
        {canManage && access.data && (
          <Button
            variant="outline"
            onClick={() => {
              setPin("");
              setError(undefined);
              setOpen(true);
            }}
          >
            <KeyRound aria-hidden="true" />
            {t(access.data.pinSet ? "PpfBookings.changePin" : "PpfBookings.setPin")}
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("Common.close")} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("PpfBookings.pinTitle")}</DialogTitle>
            <DialogDescription>{t("PpfBookings.pinBody")}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Field label={t("PpfBookings.pin")} error={error}>
              <Input
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                maxLength={6}
                className="text-center font-mono text-2xl tracking-[0.3em]"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(undefined);
                }}
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPin(randomPin());
                  setError(undefined);
                }}
              >
                <Shuffle aria-hidden="true" />
                {t("PpfBookings.generate")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("Common.saving") : t("Common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
