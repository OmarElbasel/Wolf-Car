"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/app/badges";
import { CopyButton } from "@/components/app/copy-button";
import { Field } from "@/components/app/field";
import { ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-provider";
import { PasswordInput } from "@/features/auth/login-form";
import { api, ApiError } from "@/lib/api/client";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { base } from "@/lib/motion";
import { RECOVERY_CODE_PATTERN, TOTP_CODE_PATTERN } from "@/shared/validation";
import { AccountCard } from "./account-card";
import { RecoveryCodes } from "./recovery-codes";

export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export const TWO_FACTOR_STATUS_KEY = ["account", "2fa"] as const;
const LOW_CODES = 3;

const errorCode = (e: unknown) => (e instanceof ApiError ? e.code : undefined);

function CodeInput({ value, onChange, onComplete, disabled, ...rest }: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    // digits run left-to-right, but the group sits at the start of the line like the other fields
    <div className="flex">
      <div dir="ltr">
        <InputOTP
          {...rest}
          maxLength={6}
          value={value}
          onChange={(next) => {
            onChange(next);
            if (TOTP_CODE_PATTERN.test(next)) onComplete?.(next);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          disabled={disabled}
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTPSlot key={i} index={i} className="size-12 text-lg font-bold" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
    </div>
  );
}

function StepLabel({ step }: { step: number }) {
  const t = useTranslations("Account.twoFactor");
  return <p className="text-[13px] font-bold text-accent-ink">{t("step", { step, steps: 3 })}</p>;
}

/** Wizard: confirm password → scan the QR and verify a code → save the recovery codes. */
function EnableDialog({ open, onClose, onEnabled }: { open: boolean; onClose: () => void; onEnabled: () => void }) {
  const t = useTranslations("Account.twoFactor");
  const tc = useTranslations("Common");
  const message = useErrorMessage();
  const { user } = useAuth();
  const [step, setStep] = useState<"password" | "scan" | "codes">("password");
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = step === "codes";

  const confirmPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError("required");
    setError(null);
    setBusy(true);
    try {
      setSetup(await api<TwoFactorSetup>("/account/2fa/setup", { method: "POST", json: { password } }));
      setPassword("");
      setStep("scan");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (busy) return;
    if (!TOTP_CODE_PATTERN.test(value)) return setError("code6");
    setError(null);
    setBusy(true);
    try {
      const result = await api<{ recoveryCodes: string[] }>("/account/2fa/enable", { method: "POST", json: { code: value } });
      setCodes(result.recoveryCodes);
      setStep("codes");
    } catch (err) {
      setError(message(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !locked && !busy && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        closeLabel={tc("close")}
        showCloseButton={!locked}
        onEscapeKeyDown={(e) => locked && e.preventDefault()}
        onPointerDownOutside={(e) => locked && e.preventDefault()}
      >
        <DialogHeader>
          <StepLabel step={step === "password" ? 1 : step === "scan" ? 2 : 3} />
          <DialogTitle>{locked ? t("recoveryTitle") : t("setupTitle")}</DialogTitle>
          {step === "password" && <DialogDescription>{t("stepPassword")}</DialogDescription>}
          {step === "scan" && <DialogDescription>{t("stepScan")}</DialogDescription>}
          {step === "codes" && <DialogDescription className="sr-only">{t("recoveryBody")}</DialogDescription>}
        </DialogHeader>

        <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={base}>
          {step === "password" && (
            <form onSubmit={confirmPassword} noValidate className="grid gap-4">
              <Field label={t("password")} error={error ?? undefined}>
                <PasswordInput autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={busy}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? tc("loading") : t("continue")}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === "scan" && setup && (
            <form
              noValidate
              className="grid gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                void verify();
              }}
            >
              <div className="grid items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                <Image
                  src={setup.qrDataUrl}
                  alt={t("qrAlt")}
                  width={176}
                  height={176}
                  unoptimized
                  className="mx-auto size-44 rounded-[var(--radius-brand)] border border-line bg-white p-2"
                />
                <div className="grid min-w-0 gap-2">
                  <p className="text-[13px] font-bold text-ink-2">{t("manualKey")}</p>
                  <p className="font-mono text-[15px] leading-relaxed font-bold break-words select-all">
                    <span dir="ltr" data-testid="manual-key">
                      {setup.secret.match(/.{1,4}/g)?.join(" ")}
                    </span>
                  </p>
                  <div>
                    <CopyButton value={setup.secret} label={t("copyKey")} />
                  </div>
                </div>
              </div>
              <Field label={t("stepVerify")} error={error ?? undefined}>
                <CodeInput value={code} onChange={setCode} onComplete={(v) => void verify(v)} disabled={busy} />
              </Field>
              <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={busy}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={busy || !TOTP_CODE_PATTERN.test(code)}>
                  {t("verify")}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === "codes" && <RecoveryCodes codes={codes} username={user?.username ?? ""} onAcknowledge={onEnabled} />}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Password + authenticator code (or a recovery code) to confirm a sensitive
 * 2FA change: turning it off, or replacing the recovery codes.
 */
function SecondFactorDialog({
  open,
  mode,
  onClose,
  onDone,
}: {
  open: boolean;
  mode: "disable" | "regenerate";
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("Account.twoFactor");
  const tc = useTranslations("Common");
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"code" | "recovery">("code");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [errors, setErrors] = useState<{ password?: string; code?: string }>({});
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const locked = codes !== null;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const recovery = recoveryCode.trim().toLowerCase();
    const next: typeof errors = {};
    if (!password) next.password = "required";
    if (method === "code" && !TOTP_CODE_PATTERN.test(code)) next.code = "code6";
    if (method === "recovery" && !RECOVERY_CODE_PATTERN.test(recovery)) next.code = "recoveryCode";
    setErrors(next);
    if (next.password || next.code) return;
    setBusy(true);
    const json = { password, ...(method === "code" ? { code } : { recoveryCode: recovery }) };
    try {
      if (mode === "regenerate") {
        const result = await api<{ recoveryCodes: string[] }>("/account/2fa/recovery-codes", { method: "POST", json });
        setCodes(result.recoveryCodes);
      } else {
        await api<void>("/account/2fa/disable", { method: "POST", json });
        onDone();
      }
    } catch (err) {
      const code = errorCode(err);
      if (code === "WRONG_PASSWORD") setErrors({ password: message(err) });
      else if (code === "INVALID_2FA") {
        setErrors({ code: message(err) });
        setCode("");
      } else {
        toast.error(message(err));
        if (code === "2FA_DISABLED") {
          void queryClient.invalidateQueries({ queryKey: TWO_FACTOR_STATUS_KEY });
          onClose();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const title = locked ? t("recoveryTitle") : mode === "disable" ? t("disableTitle") : t("regenerateTitle");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !locked && !busy && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        closeLabel={tc("close")}
        showCloseButton={!locked}
        onEscapeKeyDown={(e) => locked && e.preventDefault()}
        onPointerDownOutside={(e) => locked && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={locked ? "sr-only" : undefined}>
            {locked ? t("recoveryBody") : mode === "disable" ? t("disableBody") : t("regenerateBody")}
          </DialogDescription>
        </DialogHeader>
        {codes ? (
          <RecoveryCodes codes={codes} username={user?.username ?? ""} onAcknowledge={onDone} />
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4">
            <Field label={t("password")} error={errors.password}>
              <PasswordInput autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {method === "code" ? (
              <Field label={t("code")} error={errors.code}>
                <CodeInput value={code} onChange={setCode} disabled={busy} />
              </Field>
            ) : (
              <Field label={t("recoveryCode")} error={errors.code}>
                <Input
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="abcde-fghij"
                  dir="ltr"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="text-start font-mono"
                />
              </Field>
            )}
            <div>
              <button
                type="button"
                className="inline-flex min-h-11 items-center text-sm font-bold text-accent-ink hover:underline"
                onClick={() => {
                  setMethod(method === "code" ? "recovery" : "code");
                  setErrors((current) => ({ password: current.password }));
                }}
              >
                {method === "code" ? t("useRecovery") : t("useCode")}
              </button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                {tc("cancel")}
              </Button>
              <Button type="submit" variant={mode === "disable" ? "destructive" : "default"} disabled={busy}>
                {busy ? tc("loading") : mode === "disable" ? t("disableSubmit") : t("regenerateSubmit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 2FA status with the enable wizard, recovery-code regeneration and disabling. */
export function TwoFactorCard() {
  const t = useTranslations("Account.twoFactor");
  const queryClient = useQueryClient();
  const { reload } = useAuth();
  const [dialog, setDialog] = useState<"enable" | "disable" | "regenerate" | null>(null);
  // a fresh key per opening resets the dialogs' internal state (their exit animation still plays)
  const [session, setSession] = useState(0);
  const status = useQuery({ queryKey: TWO_FACTOR_STATUS_KEY, queryFn: () => api<TwoFactorStatus>("/account/2fa") });

  const open = (which: NonNullable<typeof dialog>) => {
    setSession((n) => n + 1);
    setDialog(which);
  };
  const close = () => setDialog(null);
  const refresh = async () => {
    await Promise.all([reload(), queryClient.invalidateQueries({ queryKey: TWO_FACTOR_STATUS_KEY })]);
  };

  const enabled = status.data?.enabled ?? false;
  const remaining = status.data?.recoveryCodesRemaining ?? 0;

  return (
    <AccountCard
      icon={ShieldCheck}
      title={t("title")}
      body={status.data ? (enabled ? t("bodyOn") : t("bodyOff")) : undefined}
      badge={status.data && <Pill tone={enabled ? "success" : "neutral"}>{enabled ? t("on") : t("off")}</Pill>}
    >
      {status.isPending ? (
        <div className="grid gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-11 w-40" />
        </div>
      ) : status.isError ? (
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      ) : enabled ? (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-2">
              <KeyRound className="size-4 text-muted" aria-hidden="true" strokeWidth={1.8} />
              {t("remaining", { count: remaining })}
            </p>
            {remaining <= LOW_CODES && (
              <p className="rounded-[var(--radius-brand)] bg-warning-soft px-3 py-2 text-[14px] font-semibold text-warning">{t("lowCodes")}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => open("regenerate")}>
              <KeyRound aria-hidden="true" />
              {t("regenerate")}
            </Button>
            <Button variant="destructive-outline" onClick={() => open("disable")}>
              <ShieldOff aria-hidden="true" />
              {t("disable")}
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => open("enable")}>
          <ShieldCheck aria-hidden="true" />
          {t("enable")}
        </Button>
      )}

      <EnableDialog
        key={`enable-${session}`}
        open={dialog === "enable"}
        onClose={close}
        onEnabled={() => {
          close();
          toast.success(t("enabled"));
          void refresh();
        }}
      />
      <SecondFactorDialog
        key={`regenerate-${session}`}
        mode="regenerate"
        open={dialog === "regenerate"}
        onClose={close}
        onDone={() => {
          close();
          toast.success(t("regenerated"));
          void queryClient.invalidateQueries({ queryKey: TWO_FACTOR_STATUS_KEY });
        }}
      />
      <SecondFactorDialog
        key={`disable-${session}`}
        mode="disable"
        open={dialog === "disable"}
        onClose={close}
        onDone={() => {
          close();
          toast.success(t("disabled"));
          void refresh();
        }}
      />
    </AccountCard>
  );
}
