"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { RoleBadge } from "@/components/app/badges";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import type { IssuedCredentials, RoleName, UserView } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { cn } from "@/lib/utils";
import { DISPLAY_NAME_MAX } from "@/shared/validation";
import { applyFieldErrors, displayName, EMAIL_MAX, optionalEmail } from "../shared/forms";
import { isolate, useFieldError } from "../shared/ui";

/** Roles that can be created or switched to here; branch staff come with their branch. */
export const ACCOUNT_ROLES = ["SUPER_ADMIN", "FINANCE"] as const satisfies readonly RoleName[];
type AccountRole = (typeof ACCOUNT_ROLES)[number];
const isAccountRole = (role: RoleName): role is AccountRole => (ACCOUNT_ROLES as readonly RoleName[]).includes(role);

const createSchema = z.object({ displayName, email: optionalEmail, role: z.enum(ACCOUNT_ROLES) });
type CreateValues = z.infer<typeof createSchema>;

export function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (credentials: IssuedCredentials) => void;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("Common.close")} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Users.createTitle")}</DialogTitle>
          <DialogDescription>{t("Users.createHint")}</DialogDescription>
        </DialogHeader>
        <CreateUserForm onCancel={() => onOpenChange(false)} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  );
}

function CreateUserForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (credentials: IssuedCredentials) => void }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { displayName: "", email: "", role: "FINANCE" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      const res = await api<{ user: UserView; credentials: IssuedCredentials }>("/users", {
        method: "POST",
        json: { displayName: values.displayName, role: values.role, ...(values.email ? { email: values.email } : {}) },
      });
      onCreated(res.credentials);
    } catch (e) {
      const matched = applyFieldErrors(e, ["displayName", "email", "role"] as const, (f) => form.setError(f, { message: "invalid" }));
      if (!matched) toast.error(message(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label={t("Users.displayName")} error={fe(errors.displayName?.message)}>
        <Input autoComplete="off" dir="auto" maxLength={DISPLAY_NAME_MAX} autoFocus {...form.register("displayName")} />
      </Field>
      <Field label={t("Users.email")} optional error={fe(errors.email?.message, { max: EMAIL_MAX })}>
        <Input type="email" autoComplete="off" dir="ltr" spellCheck={false} {...form.register("email")} />
      </Field>
      <Controller
        control={form.control}
        name="role"
        render={({ field }) => (
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-bold text-ink-2">{t("Users.role")}</legend>
            {ACCOUNT_ROLES.map((role) => (
              <RoleChoice
                key={role}
                name={field.name}
                role={role}
                hint={t(role === "SUPER_ADMIN" ? "Users.roleSuperAdminHint" : "Users.roleFinanceHint")}
                checked={field.value === role}
                onChange={() => field.onChange(role)}
              />
            ))}
          </fieldset>
        )}
      />
      <DialogFooter className="mt-1">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("Common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("Common.saving") : t("Common.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RoleChoice({ name, role, hint, checked, onChange }: { name: string; role: AccountRole; hint: string; checked: boolean; onChange: () => void }) {
  const t = useTranslations("Common.roles");
  const id = useId();
  return (
    <div className="relative">
      <input
        type="radio"
        id={id}
        name={name}
        value={role}
        checked={checked}
        onChange={onChange}
        className="peer absolute opacity-0"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
      />
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-[var(--radius-brand)] border-[1.5px] border-line p-3 transition-colors hover:border-[#CFCBC4] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-ink dark:hover:border-[#3a3733]",
          checked && "border-ink hover:border-ink dark:hover:border-ink",
        )}
      >
        <span
          aria-hidden="true"
          className={cn("mt-1 grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-[#CFCBC4]", checked && "border-accent")}
        >
          {checked && <span className="size-2 rounded-full bg-accent" />}
        </span>
        <span className="grid gap-0.5">
          <span id={`${id}-label`} className="font-bold">
            {t(role)}
          </span>
          <span id={`${id}-hint`} className="text-[13px] text-ink-2">
            {hint}
          </span>
        </span>
      </label>
    </div>
  );
}

const editSchema = z.object({ displayName, email: optionalEmail, role: z.string(), isActive: z.boolean() });
type EditValues = z.infer<typeof editSchema>;

export function EditUserSheet({
  user,
  open,
  isSelf,
  onOpenChange,
}: {
  user: UserView | null;
  open: boolean;
  isSelf: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={t("Common.close")}>
        {user && (
          <>
            <SheetHeader>
              <SheetTitle>{t("Users.editTitle", { name: isolate(user.displayName) })}</SheetTitle>
              <SheetDescription>
                <span dir="ltr" className="font-mono">
                  {user.username}
                </span>
              </SheetDescription>
            </SheetHeader>
            <EditUserForm user={user} isSelf={isSelf} onDone={() => onOpenChange(false)} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditUserForm({ user, isSelf, onDone }: { user: UserView; isSelf: boolean; onDone: () => void }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const queryClient = useQueryClient();
  const canChangeRole = isAccountRole(user.role) && !isSelf;
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { displayName: user.displayName, email: user.email ?? "", role: user.role, isActive: user.isActive },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const body: Record<string, unknown> = {};
    if (values.displayName !== user.displayName) body.displayName = values.displayName;
    if (values.email !== (user.email ?? "")) body.email = values.email;
    if (canChangeRole && values.role !== user.role) body.role = values.role;
    if (!isSelf && values.isActive !== user.isActive) body.isActive = values.isActive;
    if (Object.keys(body).length === 0) return onDone();
    try {
      await api<UserView>(`/users/${user.id}`, { method: "PATCH", json: body });
      toast.success(t("Users.updated"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      onDone();
    } catch (e) {
      const matched = applyFieldErrors(e, ["displayName", "email"] as const, (f) => form.setError(f, { message: "invalid" }));
      if (!matched) toast.error(message(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <SheetBody className="grid content-start gap-5">
        <Field label={t("Users.displayName")} error={fe(errors.displayName?.message)}>
          <Input autoComplete="off" dir="auto" maxLength={DISPLAY_NAME_MAX} {...form.register("displayName")} />
        </Field>
        <Field label={t("Users.email")} optional error={fe(errors.email?.message, { max: EMAIL_MAX })}>
          <Input type="email" autoComplete="off" dir="ltr" spellCheck={false} {...form.register("email")} />
        </Field>

        {canChangeRole ? (
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <RoleSelectField value={field.value} onChange={field.onChange} />
            )}
          />
        ) : (
          <div className="grid gap-1.5">
            <p className="text-sm font-bold text-ink-2">{t("Users.role")}</p>
            <div>
              <RoleBadge role={user.role} />
            </div>
            <p className="text-[13px] text-muted">{isSelf ? t("Users.selfNote") : t("Users.branchStaffNote")}</p>
          </div>
        )}

        {!isSelf && (
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4 rounded-[var(--radius-brand)] border border-line p-3">
                <div className="grid gap-0.5">
                  <Label htmlFor="user-active">{t("Users.isActive")}</Label>
                  <p id="user-active-hint" className="text-[13px] text-muted">
                    {t("Users.isActiveHint")}
                  </p>
                </div>
                <Switch id="user-active" checked={field.value} onCheckedChange={field.onChange} aria-describedby="user-active-hint" className="mt-0.5" />
              </div>
            )}
          />
        )}
      </SheetBody>
      <SheetFooter className="mt-6">
        <Button variant="outline" onClick={onDone} disabled={isSubmitting}>
          {t("Common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("Common.saving") : t("Common.save")}
        </Button>
      </SheetFooter>
    </form>
  );
}

function RoleSelectField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="user-role">{t("Users.role")}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="user-role" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {ACCOUNT_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {t(`Common.roles.${role}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
