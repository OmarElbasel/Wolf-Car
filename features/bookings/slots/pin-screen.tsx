"use client";

import { LockOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { AuthCard } from "@/components/app/auth-card";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { pinField } from "../shared/schemas";
import { slotsApi } from "./api";

/** One shared PIN, typed once per phone. */
export function PinScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const parsed = pinField.safeParse(pin);
    if (!parsed.success) return setInvalid(true);
    setBusy(true);
    try {
      await slotsApi("/unlock", { method: "POST", json: { pin: parsed.data } });
      onUnlocked();
    } catch (e) {
      setError(message(e));
      setPin("");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard brand={t("Brand.name")} title={t("Slots.title")} subtitle={t("Slots.pinSubtitle")}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {error && (
          <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
            {error}
          </p>
        )}
        <Field label={t("Slots.pin")} error={invalid ? "pin" : undefined}>
          <Input
            ref={input}
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            maxLength={6}
            autoFocus
            className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setInvalid(false);
            }}
          />
        </Field>
        <Button type="submit" size="touch" disabled={busy} className="w-full">
          <LockOpen aria-hidden="true" />
          {busy ? t("Slots.opening") : t("Slots.open")}
        </Button>
      </form>
    </AuthCard>
  );
}
