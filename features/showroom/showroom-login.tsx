"use client";

import { useQuery } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/app/auth-card";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import type { BranchSummary } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { normaliseDigits, SHOWROOM_PIN_PATTERN } from "@/shared/validation";

/** The branch this screen last signed in to, so staff only pick it once. */
const BRANCH_KEY = "wc.showroom.branch";

const remembered = () => {
  try {
    return localStorage.getItem(BRANCH_KEY) ?? "";
  } catch {
    return "";
  }
};

async function fetchBranches(): Promise<BranchSummary[]> {
  const res = await fetch("/api/auth/showroom/branches", { credentials: "same-origin" });
  if (!res.ok) throw new Error("branches unavailable");
  return (await res.json()) as BranchSummary[];
}

/**
 * Showroom sign-in on the branch's screen: pick the branch, type its 6-digit
 * PIN (set in the dashboard under Branches). No username and no password.
 */
export function ShowroomLogin() {
  const t = useTranslations("Auth");
  const brand = useTranslations("Brand");
  const locale = useLocale();
  const message = useErrorMessage();
  const router = useRouter();
  const { status, pinLogin } = useAuth();
  const branches = useQuery({ queryKey: ["showroom", "branches"], queryFn: fetchBranches, enabled: status === "anonymous" });
  const [picked, setPicked] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/showroom");
  }, [status, router]);

  const options = branches.data ?? [];
  // the remembered branch, else the only one there is
  const stored = picked || remembered();
  const branchId = options.some((b) => b.id === stored) ? stored : options.length === 1 ? options[0].id : "";
  const ready = branchId !== "" && SHOWROOM_PIN_PATTERN.test(pin);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || busy) return;
    setError(null);
    setBusy(true);
    try {
      await pinLogin(branchId, pin);
      try {
        localStorage.setItem(BRANCH_KEY, branchId);
      } catch {
        /* a private window: the branch is simply picked again next time */
      }
      router.replace("/showroom");
    } catch (e) {
      setError(message(e));
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      brand={brand("name")}
      title={t("showroomTitle")}
      subtitle={t("showroomPinSubtitle")}
      footer={
        <Link href="/login" className="inline-flex min-h-11 items-center font-bold text-accent-ink hover:underline">
          {t("staffLogin")}
        </Link>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4">
        {(error || branches.isError) && (
          <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
            {error ?? t("showroomBranchesError")}
          </p>
        )}
        {branches.isSuccess && options.length === 0 && (
          <p role="status" className="rounded-[var(--radius-brand)] bg-sand px-3 py-2.5 text-[15px] font-semibold text-ink-2">
            {t("showroomNoBranches")}
          </p>
        )}
        <Field label={t("showroomBranch")}>
          <select
            value={branchId}
            onChange={(e) => setPicked(e.target.value)}
            disabled={options.length === 0}
            className="h-[52px] w-full rounded-lg border-[1.5px] border-input bg-surface px-3 text-base font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:opacity-50"
          >
            <option value="" disabled>
              {t("showroomPickBranch")}
            </option>
            {options.map((b) => (
              <option key={b.id} value={b.id}>
                {locale === "ar" ? b.nameAr : b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("showroomPin")}>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(normaliseDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className="h-[52px] text-center font-mono text-2xl tracking-[0.5em] md:text-2xl"
          />
        </Field>
        <Button type="submit" size="touch" disabled={!ready || busy || status === "authenticated"} className="mt-1 w-full">
          <LogIn className="rtl:-scale-x-100" aria-hidden="true" />
          {busy ? t("signingIn") : t("openShowroom")}
        </Button>
      </form>
    </AuthCard>
  );
}
