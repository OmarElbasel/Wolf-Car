"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { AuthCard } from "@/components/app/auth-card";
import { useAuth } from "@/features/auth/auth-provider";
import { LoginForm } from "@/features/auth/login-form";
import { homePath, safeNext } from "@/features/auth/navigation";
import { useRouter } from "@/i18n/navigation";
import type { Profile } from "@/lib/api/types";

function LoginInner() {
  const t = useTranslations("Auth");
  const brand = useTranslations("Brand");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { status, user } = useAuth();
  const next = safeNext(params.get("next"), locale);
  const reason = params.get("reason");

  const go = (profile: Profile) => router.replace(next ?? homePath(profile.role));

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(next ?? homePath(user.role));
  }, [status, user, next, router]);

  return (
    <AuthCard brand={brand("name")} title={t("title")} subtitle={t("subtitle")} footer={t("noAccount")}>
      {reason && (
        <p role="status" className="mb-4 rounded-[var(--radius-brand)] bg-sand px-3 py-2.5 text-[15px] font-semibold text-ink-2">
          {reason === "password" ? t("passwordChanged") : t("sessionEnded")}
        </p>
      )}
      <LoginForm onSignedIn={go} />
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
