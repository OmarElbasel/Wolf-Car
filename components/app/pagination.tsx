"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("Common");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t("pageOf", { page, pages })}>
      <p className="text-sm text-muted">{t("pageOf", { page, pages })}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
          {t("previous")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages}>
          {t("next")}
          <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
