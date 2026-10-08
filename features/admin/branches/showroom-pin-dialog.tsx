"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import type { BranchView } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { normaliseDigits, SHOWROOM_PIN_PATTERN } from "@/shared/validation";

const digits = (value: string) => normaliseDigits(value).replace(/\D/g, "").slice(0, 6);

function PinForm({ branch, onSaved, onCancel }: { branch: BranchView; onSaved: () => void; onCancel: () => void }) {
  const t = useTranslations("Branches");
  const tc = useTranslations("Common");
  const message = useErrorMessage();
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const invalid = !SHOWROOM_PIN_PATTERN.test(pin);
  const mismatch = pin !== repeat;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (invalid || mismatch) return;
    setSaving(true);
    try {
      await api(`/branches/${branch.id}/showroom-pin`, { method: "PUT", json: { pin } });
      onSaved();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setSaving(false);
    }
  };

  const field = "text-center font-mono text-xl tracking-[0.4em] md:text-xl";
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label={t("pinLabel")} hint={t("pinHint")} error={touched && invalid ? t("pinInvalid") : undefined}>
        <Input inputMode="numeric" autoComplete="off" dir="ltr" maxLength={6} autoFocus value={pin} onChange={(e) => setPin(digits(e.target.value))} className={field} />
      </Field>
      <Field label={t("pinRepeat")} error={touched && !invalid && mismatch ? t("pinMismatch") : undefined}>
        <Input inputMode="numeric" autoComplete="off" dir="ltr" maxLength={6} value={repeat} onChange={(e) => setRepeat(digits(e.target.value))} className={field} />
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? tc("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Sets or changes the PIN a branch's showroom screen signs in with (PUT /branches/:id/showroom-pin). */
export function ShowroomPinDialog({ branch, onClose, onSaved }: { branch: BranchView | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("Branches");
  const tc = useTranslations("Common");
  const locale = useLocale();
  return (
    <Dialog open={branch !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent closeLabel={tc("close")}>
        {branch && (
          <>
            <DialogHeader>
              <DialogTitle>{t("pinTitle", { name: locale === "ar" ? branch.nameAr : branch.name })}</DialogTitle>
              <DialogDescription>{t("pinBody")}</DialogDescription>
            </DialogHeader>
            <PinForm key={branch.id} branch={branch} onSaved={onSaved} onCancel={onClose} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
