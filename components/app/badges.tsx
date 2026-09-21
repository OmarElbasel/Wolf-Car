"use client";

import { useTranslations } from "next-intl";
import type { OrderStatusName, RoleName } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<OrderStatusName, string> = {
  PENDING: "bg-warning-soft text-warning",
  CONFIRMED: "bg-success-soft text-success",
  CANCELLED: "bg-sand text-muted line-through decoration-1",
};

export function OrderStatusBadge({ status }: { status: OrderStatusName }) {
  const t = useTranslations("Common.orderStatus");
  return (
    <span className={cn("inline-flex items-center rounded-[6px] px-2 py-0.5 text-[13px] font-bold", STATUS_CLASS[status])}>
      {t(status)}
    </span>
  );
}

export function RoleBadge({ role }: { role: RoleName }) {
  const t = useTranslations("Common.roles");
  return <span className="inline-flex items-center rounded-[6px] bg-sand px-2 py-0.5 text-[13px] font-bold text-ink-2">{t(role)}</span>;
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-sand text-ink-2",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[13px] font-bold", tones[tone])}>{children}</span>;
}
