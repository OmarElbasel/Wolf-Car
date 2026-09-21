"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, LogIn } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useErrorMessage } from "@/lib/api/use-error-message";
import type { Profile } from "@/lib/api/types";
import { base } from "@/lib/motion";
import { RECOVERY_CODE_PATTERN, TOTP_CODE_PATTERN } from "@/shared/validation";
import { useAuth } from "./auth-provider";

const credentialsSchema = z.object({
  username: z.string().trim().min(1, "required").max(40, "invalid"),
  password: z.string().min(1, "required").max(128, "invalid"),
});
type Credentials = z.infer<typeof credentialsSchema>;

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const t = useTranslations("Auth");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pe-12" dir="ltr" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 end-0 grid w-11 place-items-center text-muted hover:text-ink"
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
      </button>
    </div>
  );
}

/**
 * Username + password, then (if enabled) a TOTP or recovery code. Used for
 * the dashboard; the role returned by the API decides where the user lands.
 */
export function LoginForm({ onSignedIn }: { onSignedIn: (user: Profile) => void }) {
  const t = useTranslations("Auth");
  const message = useErrorMessage();
  const { login, verifyTwoFactor } = useAuth();
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Credentials>({ resolver: zodResolver(credentialsSchema), defaultValues: { username: "", password: "" } });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await login(values.username, values.password);
      if ("twoFactorRequired" in result) setChallenge(result.challengeToken);
      else onSignedIn(result);
    } catch (e) {
      setError(message(e));
      form.resetField("password");
      form.setFocus("password");
    }
  });

  return (
    <AnimatePresence mode="wait" initial={false}>
      {challenge ? (
        <motion.div key="2fa" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={base}>
          <TwoFactorStep
            onVerify={async (second) => onSignedIn(await verifyTwoFactor(challenge, second))}
            onRestart={() => {
              setChallenge(null);
              form.reset({ username: form.getValues("username"), password: "" });
            }}
          />
        </motion.div>
      ) : (
        <motion.form key="password" onSubmit={submit} noValidate className="grid gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={base}>
          {error && (
            <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
              {error}
            </p>
          )}
          <Field label={t("username")} error={form.formState.errors.username?.message}>
            <Input autoComplete="username" autoCapitalize="none" spellCheck={false} dir="ltr" autoFocus {...form.register("username")} />
          </Field>
          <Field label={t("password")} error={form.formState.errors.password?.message}>
            <PasswordInput autoComplete="current-password" {...form.register("password")} />
          </Field>
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="mt-1 w-full">
            <LogIn className="rtl:-scale-x-100" aria-hidden="true" />
            {form.formState.isSubmitting ? t("signingIn") : t("signIn")}
          </Button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

function TwoFactorStep({
  onVerify,
  onRestart,
}: {
  onVerify: (second: { code: string } | { recoveryCode: string }) => Promise<void>;
  onRestart: () => void;
}) {
  const t = useTranslations("Auth");
  const message = useErrorMessage();
  const [mode, setMode] = useState<"code" | "recovery">("code");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = mode === "code" ? TOTP_CODE_PATTERN.test(value) : RECOVERY_CODE_PATTERN.test(value.trim().toLowerCase());
  const submit = async (code = value) => {
    setError(null);
    setBusy(true);
    try {
      await onVerify(mode === "code" ? { code } : { recoveryCode: code.trim().toLowerCase() });
    } catch (e) {
      setError(message(e));
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void submit();
      }}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-brand)] bg-sand text-accent-ink">
          <KeyRound className="size-[22px]" aria-hidden="true" strokeWidth={1.8} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold">{t("twoFactorTitle")}</h2>
          <p className="text-[15px] text-ink-2">{mode === "code" ? t("twoFactorBody") : t("recoveryCode")}</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      {mode === "code" ? (
        <div dir="ltr" className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={value}
            onChange={(v) => {
              setValue(v);
              if (TOTP_CODE_PATTERN.test(v)) void submit(v);
            }}
            autoFocus
            aria-label={t("code")}
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={busy}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, i) => (
                <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      ) : (
        <Field label={t("recoveryCode")}>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="abcde-fghij" dir="ltr" autoComplete="off" autoFocus />
        </Field>
      )}
      <Button type="submit" size="lg" disabled={!valid || busy} className="w-full">
        {busy ? t("signingIn") : t("verify")}
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button
          type="button"
          className="font-bold text-accent-ink hover:underline"
          onClick={() => {
            setMode(mode === "code" ? "recovery" : "code");
            setValue("");
            setError(null);
          }}
        >
          {mode === "code" ? t("useRecovery") : t("useCode")}
        </button>
        <button type="button" className="font-semibold text-muted hover:text-ink" onClick={onRestart}>
          {t("startOver")}
        </button>
      </div>
    </form>
  );
}
