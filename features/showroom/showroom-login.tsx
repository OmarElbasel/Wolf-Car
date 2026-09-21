"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard } from "@/components/app/auth-card";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { PasswordInput } from "@/features/auth/login-form";
import { Link, useRouter } from "@/i18n/navigation";
import { useErrorMessage } from "@/lib/api/use-error-message";

const schema = z.object({
  username: z.string().trim().min(1, "required").max(40, "invalid"),
  password: z.string().min(1, "required").max(128, "invalid"),
});
type Values = z.infer<typeof schema>;

/**
 * Showroom sign-in on the branch tablet: username + the separate showroom
 * password (the provider posts to /auth/showroom/login; there is no 2FA here).
 */
export function ShowroomLogin() {
  const t = useTranslations("Auth");
  const brand = useTranslations("Brand");
  const message = useErrorMessage();
  const router = useRouter();
  const { status, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "" } });

  useEffect(() => {
    if (status === "authenticated") router.replace("/showroom");
  }, [status, router]);

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await login(values.username, values.password);
      // showroom sessions never ask for a second factor
      if ("twoFactorRequired" in result) throw new Error("unexpected 2FA challenge");
      router.replace("/showroom");
    } catch (e) {
      setError(message(e));
      form.resetField("password");
      form.setFocus("password");
    }
  });

  return (
    <AuthCard
      brand={brand("name")}
      title={t("showroomTitle")}
      subtitle={t("showroomSubtitle")}
      footer={
        <Link href="/login" className="inline-flex min-h-11 items-center font-bold text-accent-ink hover:underline">
          {t("staffLogin")}
        </Link>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4">
        {error && (
          <p role="alert" className="rounded-[var(--radius-brand)] bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger">
            {error}
          </p>
        )}
        <Field label={t("username")} error={form.formState.errors.username?.message}>
          <Input
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            dir="ltr"
            autoFocus
            className="text-start"
            {...form.register("username")}
          />
        </Field>
        <Field label={t("showroomPassword")} error={form.formState.errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...form.register("password")} />
        </Field>
        <Button type="submit" size="touch" disabled={form.formState.isSubmitting || status === "authenticated"} className="mt-1 w-full">
          <LogIn className="rtl:-scale-x-100" aria-hidden="true" />
          {form.formState.isSubmitting ? t("signingIn") : t("openShowroom")}
        </Button>
      </form>
    </AuthCard>
  );
}
