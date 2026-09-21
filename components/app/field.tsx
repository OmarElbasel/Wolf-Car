"use client";

import { useTranslations } from "next-intl";
import { cloneElement, isValidElement, type ReactElement, type ReactNode, useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label + control + hint + inline error, wired for screen readers
 * (aria-invalid, aria-describedby). `error` may be a Validation.* key.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const t = useTranslations();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const message = error ? (t.has(`Validation.${error}`) ? t(`Validation.${error}`) : error) : undefined;
  const describedBy = [hint ? hintId : null, message ? errorId : null].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, "aria-invalid": message ? true : undefined, "aria-describedby": describedBy })
    : children;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-medium text-muted">({t("Common.optional")})</span>}
      </Label>
      {control}
      {hint && !message && (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {message && (
        <p id={errorId} className="text-[13px] font-semibold text-danger" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
