"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError, api } from "@/lib/api/client";
import type { BranchView, IssuedCredentials } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { BRANCH_CODE_PATTERN, BRANCH_NAME_MAX, DISPLAY_NAME_MAX } from "@/shared/validation";
import { applyFieldErrors, displayName, EMAIL_MAX, optionalEmail } from "../shared/forms";
import { isolate, useBranchName, useFieldError } from "../shared/ui";

export type StaffSlot = "manager" | "cashier";
export const SLOT_ROLE = { manager: "BRANCH_MANAGER", cashier: "CASHIER" } as const;

const branchName = z.string().trim().min(1, "required").min(2, "tooShort").max(BRANCH_NAME_MAX, "tooLong");
const staff = z.object({ displayName, email: optionalEmail });
const staffBody = (s: z.infer<typeof staff>) => ({ displayName: s.displayName, ...(s.email ? { email: s.email } : {}) });

const createSchema = z.object({
  code: z.string().trim().min(1, "required").regex(BRANCH_CODE_PATTERN, "branchCode"),
  name: branchName,
  nameAr: branchName,
  manager: staff,
  cashier: staff,
});
type CreateValues = z.infer<typeof createSchema>;
type CreateField = "code" | "name" | "nameAr" | "manager.displayName" | "manager.email" | "cashier.displayName" | "cashier.email";
const CREATE_FIELDS: CreateField[] = ["code", "name", "nameAr", "manager.displayName", "manager.email", "cashier.displayName", "cashier.email"];

export function CreateBranchSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (credentials: IssuedCredentials[]) => void;
}) {
  const t = useTranslations();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={t("Common.close")}>
        <SheetHeader>
          <SheetTitle>{t("Branches.createTitle")}</SheetTitle>
          <SheetDescription>{t("Branches.createHint")}</SheetDescription>
        </SheetHeader>
        <CreateBranchForm onCancel={() => onOpenChange(false)} onCreated={onCreated} />
      </SheetContent>
    </Sheet>
  );
}

function CreateBranchForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (credentials: IssuedCredentials[]) => void }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { code: "", name: "", nameAr: "", manager: { displayName: "", email: "" }, cashier: { displayName: "", email: "" } },
  });
  const { errors, isSubmitting } = form.formState;
  const nameLimits = { max: BRANCH_NAME_MAX };

  const submit = form.handleSubmit(async (values) => {
    try {
      const res = await api<{ branch: BranchView; credentials: IssuedCredentials[] }>("/branches", {
        method: "POST",
        json: {
          code: values.code,
          name: values.name,
          nameAr: values.nameAr,
          manager: staffBody(values.manager),
          cashier: staffBody(values.cashier),
        },
      });
      onCreated(res.credentials);
    } catch (e) {
      if (e instanceof ApiError && e.code === "DUPLICATE") {
        form.setError("code", { message: t("Branches.codeTaken") }, { shouldFocus: true });
        return;
      }
      const matched = applyFieldErrors(e, CREATE_FIELDS, (f) => form.setError(f, { message: "invalid" }));
      if (!matched) toast.error(message(e));
    }
  });

  const staffFields = (slot: StaffSlot) => (
    <fieldset className="grid gap-4 rounded-[var(--radius-brand)] border border-line p-4">
      <legend className="px-1 text-[15px] font-extrabold">{t(slot === "manager" ? "Branches.manager" : "Branches.cashier")}</legend>
      <Field label={t("Branches.staffName")} error={fe(errors[slot]?.displayName?.message)}>
        <Input autoComplete="off" dir="auto" maxLength={DISPLAY_NAME_MAX} {...form.register(`${slot}.displayName`)} />
      </Field>
      <Field label={t("Branches.staffEmail")} optional error={fe(errors[slot]?.email?.message, { max: EMAIL_MAX })}>
        <Input type="email" autoComplete="off" dir="ltr" spellCheck={false} {...form.register(`${slot}.email`)} />
      </Field>
    </fieldset>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <SheetBody className="grid content-start gap-5">
        <Controller
          control={form.control}
          name="code"
          render={({ field }) => (
            <Field label={t("Branches.code")} hint={t("Branches.codeHint")} error={errors.code?.message}>
              <Input
                name={field.name}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                dir="ltr"
                maxLength={4}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="max-w-40 font-mono tracking-[0.12em] uppercase"
              />
            </Field>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Branches.name")} error={fe(errors.name?.message, nameLimits)}>
            <Input autoComplete="off" dir="ltr" maxLength={BRANCH_NAME_MAX} {...form.register("name")} />
          </Field>
          <Field label={t("Branches.nameAr")} error={fe(errors.nameAr?.message, nameLimits)}>
            <Input autoComplete="off" dir="rtl" lang="ar" maxLength={BRANCH_NAME_MAX} {...form.register("nameAr")} />
          </Field>
        </div>
        {staffFields("manager")}
        {staffFields("cashier")}
      </SheetBody>
      <SheetFooter className="mt-6">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("Common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("Common.saving") : t("Common.create")}
        </Button>
      </SheetFooter>
    </form>
  );
}

const editSchema = z.object({ name: branchName, nameAr: branchName, isActive: z.boolean() });
type EditValues = z.infer<typeof editSchema>;

export function EditBranchSheet({ branch, open, onOpenChange }: { branch: BranchView | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations();
  const localName = useBranchName();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={t("Common.close")}>
        {branch && (
          <>
            <SheetHeader>
              <SheetTitle>{t("Branches.editTitle", { name: isolate(localName(branch)) })}</SheetTitle>
              <SheetDescription>
                <span dir="ltr" className="font-mono font-bold">
                  {branch.code}
                </span>
              </SheetDescription>
            </SheetHeader>
            <EditBranchForm branch={branch} onDone={() => onOpenChange(false)} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditBranchForm({ branch, onDone }: { branch: BranchView; onDone: () => void }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const queryClient = useQueryClient();
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: branch.name, nameAr: branch.nameAr, isActive: branch.isActive },
  });
  const { errors, isSubmitting } = form.formState;
  const nameLimits = { max: BRANCH_NAME_MAX };

  const submit = form.handleSubmit(async (values) => {
    const body: Partial<EditValues> = {};
    if (values.name !== branch.name) body.name = values.name;
    if (values.nameAr !== branch.nameAr) body.nameAr = values.nameAr;
    if (values.isActive !== branch.isActive) body.isActive = values.isActive;
    if (Object.keys(body).length === 0) return onDone();
    try {
      await api<BranchView>(`/branches/${branch.id}`, { method: "PATCH", json: body });
      toast.success(t("Branches.updated"));
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
      onDone();
    } catch (e) {
      const matched = applyFieldErrors(e, ["name", "nameAr"] as const, (f) => form.setError(f, { message: "invalid" }));
      if (!matched) toast.error(message(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <SheetBody className="grid content-start gap-5">
        <Field label={t("Branches.name")} error={fe(errors.name?.message, nameLimits)}>
          <Input autoComplete="off" dir="ltr" maxLength={BRANCH_NAME_MAX} {...form.register("name")} />
        </Field>
        <Field label={t("Branches.nameAr")} error={fe(errors.nameAr?.message, nameLimits)}>
          <Input autoComplete="off" dir="rtl" lang="ar" maxLength={BRANCH_NAME_MAX} {...form.register("nameAr")} />
        </Field>
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <div className="flex items-start justify-between gap-4 rounded-[var(--radius-brand)] border border-line p-3">
              <div className="grid gap-0.5">
                <Label htmlFor="branch-active">{t("Branches.active")}</Label>
                <p id="branch-active-hint" className="text-[13px] text-muted">
                  {t("Branches.inactiveHint")}
                </p>
              </div>
              <Switch id="branch-active" checked={field.value} onCheckedChange={field.onChange} aria-describedby="branch-active-hint" className="mt-0.5" />
            </div>
          )}
        />
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

const replaceSchema = staff;
type ReplaceValues = z.infer<typeof replaceSchema>;

export interface ReplaceTarget {
  branch: BranchView;
  slot: StaffSlot;
}

export function ReplaceStaffDialog({
  target,
  open,
  onOpenChange,
  onReplaced,
}: {
  target: ReplaceTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplaced: (credentials: IssuedCredentials, target: ReplaceTarget) => void;
}) {
  const t = useTranslations();
  const role = target ? t(`Common.roles.${SLOT_ROLE[target.slot]}`) : "";
  const current = target ? target.branch[target.slot] : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("Common.close")} className="sm:max-w-lg">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>{t("Branches.replaceTitle", { role })}</DialogTitle>
              <DialogDescription>{t("Branches.replaceHint")}</DialogDescription>
            </DialogHeader>
            {current && (
              <p role="note" className="flex gap-2 rounded-[var(--radius-brand)] bg-warning-soft p-3 text-[15px] font-semibold text-warning">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span>{t("Branches.replaceBody", { name: isolate(current.displayName) })}</span>
              </p>
            )}
            <ReplaceStaffForm target={target} onCancel={() => onOpenChange(false)} onReplaced={onReplaced} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReplaceStaffForm({
  target,
  onCancel,
  onReplaced,
}: {
  target: ReplaceTarget;
  onCancel: () => void;
  onReplaced: (credentials: IssuedCredentials, target: ReplaceTarget) => void;
}) {
  const t = useTranslations();
  const message = useErrorMessage();
  const fe = useFieldError();
  const form = useForm<ReplaceValues>({ resolver: zodResolver(replaceSchema), defaultValues: { displayName: "", email: "" } });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      const res = await api<{ branch: BranchView; credentials: IssuedCredentials }>(
        `/branches/${target.branch.id}/staff/${target.slot}/replace`,
        { method: "POST", json: staffBody(values) },
      );
      onReplaced(res.credentials, target);
    } catch (e) {
      const matched = applyFieldErrors(e, ["displayName", "email"] as const, (f) => form.setError(f, { message: "invalid" }));
      if (!matched) toast.error(message(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label={t("Branches.staffName")} error={fe(errors.displayName?.message)}>
        <Input autoComplete="off" dir="auto" maxLength={DISPLAY_NAME_MAX} autoFocus {...form.register("displayName")} />
      </Field>
      <Field label={t("Branches.staffEmail")} optional error={fe(errors.email?.message, { max: EMAIL_MAX })}>
        <Input type="email" autoComplete="off" dir="ltr" spellCheck={false} {...form.register("email")} />
      </Field>
      <DialogFooter className="mt-1">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("Common.cancel")}
        </Button>
        <Button type="submit" variant="destructive" disabled={isSubmitting}>
          {isSubmitting ? t("Common.saving") : t("Branches.replace")}
        </Button>
      </DialogFooter>
    </form>
  );
}
