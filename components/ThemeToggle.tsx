"use client";

import { useTranslations } from "next-intl";
import { toggleTheme } from "@/lib/theme";
import { Icon } from "./Icon";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useTranslations("Header");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={t("themeToggle")}
      aria-label={t("themeToggle")}
      className={`grid size-11 flex-none place-items-center text-ink-2 ${className}`}
    >
      {/* both icons render identically on server and client; the .dark class
          (set before paint by THEME_SCRIPT) picks which one is visible, so
          there is no theme-dependent markup to mismatch during hydration */}
      <Icon name="moon" className="size-5 dark:hidden" />
      <Icon name="sun" className="hidden size-5 dark:block" />
    </button>
  );
}
