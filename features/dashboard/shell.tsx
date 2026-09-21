"use client";

import {
  Building2,
  ChevronDown,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  ShieldCheck,
  Store,
  UserCog,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { BrandMark } from "@/components/app/brand";
import { LoadingRows } from "@/components/app/states";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/auth-provider";
import { type NavItem, visibleNav } from "@/features/auth/navigation";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<NavItem["icon"], typeof Package> = {
  home: LayoutDashboard,
  products: Package,
  orders: ReceiptText,
  users: Users,
  branches: Building2,
  permissions: ShieldCheck,
  activity: History,
  account: UserCog,
  showroom: Store,
};

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { user, can } = useAuth();
  const items = visibleNav(user?.permissions ?? []);
  return (
    <nav aria-label={t("overview")} className="grid gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-[var(--radius-brand)] px-3 text-[15px] font-semibold text-ink-2 transition-colors hover:bg-sand hover:text-ink",
              active && "bg-sand font-bold text-ink",
            )}
          >
            <Icon className={cn("size-5 shrink-0", active && "text-accent-ink")} strokeWidth={1.8} aria-hidden="true" />
            {t(item.label)}
          </Link>
        );
      })}
      {user?.branch && can("order.create") && (
        <a
          href={`/${locale}/showroom`}
          target="_blank"
          rel="noopener"
          className="mt-3 flex min-h-11 items-center gap-3 rounded-[var(--radius-brand)] border-[1.5px] border-line px-3 text-[15px] font-bold text-ink hover:border-ink"
        >
          <Store className="size-5 shrink-0 text-accent-ink" strokeWidth={1.8} aria-hidden="true" />
          {t("showroom")}
        </a>
      )}
    </nav>
  );
}

function UserMenu() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, logout } = useAuth();
  if (!user) return null;
  const branch = user.branch ? (locale === "ar" ? user.branch.nameAr : user.branch.name) : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" data-testid="user-menu">
          <span className="grid size-8 place-items-center rounded-full bg-charcoal text-sm font-extrabold text-white" aria-hidden="true">
            {user.displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden text-start leading-tight sm:block">
            <b className="block text-sm">{user.displayName}</b>
            <small className="block text-[12px] font-semibold text-muted">{t(`Common.roles.${user.role}`)}</small>
          </span>
          <ChevronDown className="size-4 text-muted" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuLabel className="grid gap-0.5">
          <span className="text-[12px] font-semibold text-muted">{t("Nav.signedInAs")}</span>
          <span dir="ltr" className="text-start font-mono text-sm">{user.username}</span>
          <span className="text-[13px] text-ink-2">
            {t(`Common.roles.${user.role}`)}
            {branch ? ` · ${branch}` : ""}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/account">
            <UserCog aria-hidden="true" />
            {t("Nav.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void logout()}
        >
          <LogOut className="rtl:-scale-x-100" aria-hidden="true" />
          {t("Common.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Staff dashboard frame. Waits for the session (restored from the refresh
 * cookie), sends signed-out visitors to /login, then renders a top bar in the
 * landing page's header style and a permission-filtered navigation.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { status, endReason } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status !== "anonymous") return;
    if (endReason === "signedOut") router.replace("/login");
    else if (endReason === "password") router.replace("/login?reason=password");
    else router.replace(`/login?reason=expired&next=${encodeURIComponent(`/${pathname}`.replace("//", "/"))}`);
  }, [status, endReason, router, pathname]);

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-[1400px] p-5">
        <LoadingRows rows={4} className="h-20" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="mx-auto flex h-[66px] max-w-[1400px] items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label={t("Common.menu")}>
              <Menu aria-hidden="true" />
            </Button>
            <Link href="/dashboard" aria-label={t("Nav.overview")}>
              <BrandMark name={t("Brand.name")} sub={t("Common.staffArea")} />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LocaleSwitcher className="hidden sm:inline-flex" />
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] lg:grid-cols-[240px_1fr]">
        <aside className="hidden border-e border-line lg:block">
          <div className="sticky top-[66px] p-4">
            <NavLinks />
          </div>
        </aside>
        <main id="main" className="min-w-0 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="start" closeLabel={t("Common.close")} className="max-w-xs">
          <SheetHeader>
            <SheetTitle>{t("Common.menu")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <NavLinks onNavigate={() => setMenuOpen(false)} />
            <div className="mt-4 sm:hidden">
              <LocaleSwitcher />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
