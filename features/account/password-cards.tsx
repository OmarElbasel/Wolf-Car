"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { PasswordInput } from "@/features/auth/login-form";
import { api, ApiError } from "@/lib/api/client";
import { fieldErrors } from "@/lib/api/errors";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { isStrongPassword, PASSWORD_MAX_LENGTH } from "@/shared/validation";
import { AccountCard } from "./account-card";
import { PasswordChecks } from "./password-checks";

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";
interface PasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function passwordSchema(username: string) {
  return z
    .object({
      currentPassword: z.string().min(1, "required").max(PASSWORD_MAX_LENGTH, "invalid"),
      newPassword: z.string().min(1, "required"),
      confirmPassword: z.string().min(1, "required"),
    })
    .superRefine((v, ctx) => {
      if (v.newPassword && !isStrongPassword(v.newPassword, username)) {
        ctx.addIssue({ code: "custom", path: ["newPassword"], message: "passwordPolicy" });
      }
      if (v.confirmPassword && v.confirmPassword !== v.newPassword) {
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "passwordsMatch" });
      }
    });
}

/**
 * Current + new + confirm password with the live rule checklist and strength
 * meter. Known API error codes land on the matching field.
 */
function PasswordForm({
  labels,
  codeFields,
  onSubmit,
  onSuccess,
}: {
  labels: { current: string; next: string; confirm: string; submit: string };
  codeFields: Record<string, PasswordField>;
  onSubmit: (values: { currentPassword: string; newPassword: string }) => Promise<void>;
  onSuccess: () => void;
}) {
  const tc = useTranslations("Common");
  const message = useErrorMessage();
  const { user } = useAuth();
  const username = user?.username ?? "";
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema(username)),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPassword = useWatch({ control: form.control, name: "newPassword" });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ currentPassword, newPassword: next }) => {
    try {
      await onSubmit({ currentPassword, newPassword: next });
      onSuccess();
      form.reset();
    } catch (e) {
      const field = e instanceof ApiError && e.code ? codeFields[e.code] : undefined;
      if (field) {
        form.setError(field, { message: message(e) }, { shouldFocus: true });
        return;
      }
      if (fieldErrors(e).newPassword) {
        form.setError("newPassword", { message: "passwordPolicy" }, { shouldFocus: true });
        return;
      }
      toast.error(message(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {/* lets password managers file the new password under the right account */}
      <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
      <Field label={labels.current} error={errors.currentPassword?.message}>
        <PasswordInput autoComplete="current-password" {...form.register("currentPassword")} />
      </Field>
      <Field label={labels.next} error={errors.newPassword?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("newPassword")} />
      </Field>
      <PasswordChecks password={newPassword} username={username} displayName={user?.displayName} />
      <Field label={labels.confirm} error={errors.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tc("saving") : labels.submit}
        </Button>
      </div>
    </form>
  );
}

/** Dashboard password. The API signs the user out everywhere afterwards. */
export function ChangePasswordCard() {
  const t = useTranslations("Account.password");
  const { expire } = useAuth();
  return (
    <AccountCard icon={KeyRound} title={t("title")} body={t("body")}>
      <PasswordForm
        labels={{ current: t("current"), next: t("new"), confirm: t("confirm"), submit: t("submit") }}
        codeFields={{
          WRONG_PASSWORD: "currentPassword",
          PASSWORD_CONTAINS_USERNAME: "newPassword",
          PASSWORD_UNCHANGED: "newPassword",
        }}
        onSubmit={(json) => api<void>("/account/password", { method: "PATCH", json })}
        // The server revoked every session; the dashboard shell then sends the
        // user to the login page with the "password changed" message.
        onSuccess={() => expire("password")}
      />
    </AccountCard>
  );
}

/** Separate password typed on the showroom tablet (branch staff only). */
export function ShowroomPasswordCard() {
  const t = useTranslations("Account.showroom");
  return (
    <AccountCard icon={Store} title={t("title")} body={t("body")}>
      <PasswordForm
        labels={{ current: t("confirmWith"), next: t("new"), confirm: t("confirm"), submit: t("submit") }}
        codeFields={{
          WRONG_PASSWORD: "currentPassword",
          SHOWROOM_SAME_AS_DASHBOARD: "newPassword",
          PASSWORD_CONTAINS_USERNAME: "newPassword",
        }}
        onSubmit={(json) => api<void>("/account/showroom-password", { method: "PATCH", json })}
        onSuccess={() => toast.success(t("saved"))}
      />
    </AccountCard>
  );
}
