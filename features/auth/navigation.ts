import type { PermissionKey, RoleName } from "@/lib/api/types";

/** Where each role lands after signing in. */
export function homePath(role: RoleName): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard";
    case "FINANCE":
    case "BRANCH_MANAGER":
      return "/dashboard/products";
    case "CASHIER":
      return "/dashboard/orders";
  }
}

/** Only same-app dashboard paths are accepted as a post-login target (no open redirect). */
export function safeNext(next: string | null | undefined, locale: string): string | null {
  if (!next) return null;
  const prefix = `/${locale}/dashboard`;
  if (!next.startsWith(prefix) || next.includes("//") || next.includes("\\")) return null;
  return next.slice(`/${locale}`.length);
}

export interface NavItem {
  href: string;
  label: string;
  /** shown when the user has ANY of these (empty = everyone signed in) */
  any: PermissionKey[];
  icon: "home" | "products" | "orders" | "users" | "branches" | "permissions" | "activity" | "account" | "showroom";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "overview", any: [], icon: "home" },
  { href: "/dashboard/products", label: "products", any: ["product.read"], icon: "products" },
  { href: "/dashboard/orders", label: "orders", any: ["order.read.branch", "order.read.all"], icon: "orders" },
  { href: "/dashboard/users", label: "users", any: ["user.manage"], icon: "users" },
  { href: "/dashboard/branches", label: "branches", any: ["branch.manage"], icon: "branches" },
  { href: "/dashboard/permissions", label: "permissions", any: ["permission.manage"], icon: "permissions" },
  { href: "/dashboard/activity", label: "activity", any: ["activity.read"], icon: "activity" },
  { href: "/dashboard/account", label: "account", any: [], icon: "account" },
];

export function visibleNav(permissions: readonly PermissionKey[]): NavItem[] {
  const set = new Set(permissions);
  return NAV_ITEMS.filter((item) => item.any.length === 0 || item.any.some((p) => set.has(p)));
}
