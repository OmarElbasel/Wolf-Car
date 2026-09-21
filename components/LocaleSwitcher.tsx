"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon } from "./Icon";

const AUTONYM: Record<string, string> = { ar: "العربية", en: "English" };

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("Header");
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={other}
      title={t("languageSwitch")}
      aria-label={t("languageSwitch")}
      className={`inline-flex min-h-11 items-center gap-1 px-1 text-sm font-bold text-ink-2 hover:text-ink ${className}`}
    >
      <Icon name="globe" className="size-[18px]" />
      {AUTONYM[other]}
    </Link>
  );
}
