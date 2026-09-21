import type { ReactNode } from "react";
import { BrandMark } from "@/components/app/brand";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link } from "@/i18n/navigation";

/** Centered sign-in card on the site's sand background. */
export function AuthCard({ brand, title, subtitle, children, footer }: {
  brand: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-sand">
      <header className="mx-auto flex w-full max-w-[1160px] items-center justify-between px-5 py-3">
        <Link href="/" aria-label={brand}>
          <BrandMark name={brand} />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </header>
      <main className="grid place-items-center px-5 pb-16">
        <div className="w-full max-w-[420px] rounded-[var(--radius-brand-lg)] border border-line bg-surface p-6 sm:p-7">
          <h1 className="text-[26px] leading-tight font-extrabold">{title}</h1>
          <p className="mt-1 mb-6 text-[15px] text-ink-2">{subtitle}</p>
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </main>
    </div>
  );
}
