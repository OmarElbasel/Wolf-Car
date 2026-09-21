"use client";

import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useSyncExternalStore, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BranchSummary, PermissionKey } from "@/lib/api/types";
import { msgKey } from "@/lib/i18n/keys";
import { cn } from "@/lib/utils";
import { DISPLAY_NAME_MAX } from "@/shared/validation";

/** True from the `md` breakpoint up (tables there, cards on phones). */
export function useWideLayout(query = "(min-width: 768px)"): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Wraps user-entered text (names) in Unicode first-strong isolates, the plain
 * text version of dir="auto": an English name inside an Arabic sentence (or
 * the reverse) keeps its own direction and punctuation.
 */
export const isolate = (text: string) => `\u2068${text}\u2069`;

/** Branch name in the current language. */
export function useBranchName(): (branch: Pick<BranchSummary, "name" | "nameAr"> | null | undefined) => string {
  const locale = useLocale();
  return (branch) => (branch ? (locale === "ar" ? branch.nameAr : branch.name) : "—");
}

/**
 * Field errors are Validation.* keys; the length ones need their limit, which
 * <Field> can't know, so they are translated here.
 */
export function useFieldError(): (error: string | undefined, limits?: { min?: number; max?: number }) => string | undefined {
  const t = useTranslations("Validation");
  return (error, limits = {}) => {
    if (error === "tooShort") return t("tooShort", { min: limits.min ?? 2 });
    if (error === "tooLong") return t("tooLong", { max: limits.max ?? DISPLAY_NAME_MAX });
    return error;
  };
}

/** Friendly state for a page the signed-in user has no permission for (the API would refuse anyway). */
export function NoAccess({ permission }: { permission: PermissionKey }) {
  const t = useTranslations("Permissions");
  return (
    <div role="alert" className="grid place-items-center gap-3 rounded-[var(--radius-brand-lg)] border border-dashed border-line px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-sand">
        <Lock className="size-5 text-ink-2" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="max-w-md">
        <p className="text-lg font-extrabold">{t("noAccessTitle")}</p>
        <p className="mt-1 text-[15px] text-ink-2">{t("noAccessBody", { permission: t(`labels.${msgKey(permission)}`) })}</p>
      </div>
    </div>
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * A filter dropdown. Radix Select can't hold an empty value, so "" (no
 * filter) is represented by the first option with value ALL.
 */
export const ALL = "__all";

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  showLabel = false,
  className,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  showLabel?: boolean;
  className?: string;
  /** extra SelectContent children (e.g. grouped options) */
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      {showLabel && <Label htmlFor={id}>{label}</Label>}
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger id={id} aria-label={showLabel ? undefined : label} className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value || ALL}>
              {o.label}
            </SelectItem>
          ))}
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}

