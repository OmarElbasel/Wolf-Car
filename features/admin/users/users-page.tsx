"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldCheck,
  ShieldOff,
  Store,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Pill, RoleBadge } from "@/components/app/badges";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { CredentialsDialog } from "@/components/app/credentials-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { EmptyState, ErrorState, LoadingRows, NoAccess } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import type { BranchOption, IssuedCredentials, Page, UserView } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BRANCH_ROLES, ROLES } from "@/shared/permissions";
import { FilterSelect, isolate, useBranchName, useWideLayout } from "../shared/ui";
import { useDebouncedCallback, useUrlState } from "../shared/url-state";
import { CreateUserDialog, EditUserSheet } from "./user-forms";

export const USERS_PAGE_SIZE = 20;
const FILTER_KEYS = ["q", "role", "branch", "status", "page"] as const;

type ConfirmKind = "resetPassword" | "resetShowroom" | "reset2fa" | "deactivate" | "delete";

const isBranchStaff = (u: UserView) => BRANCH_ROLES.includes(u.role);

/** Super Admin: every account, with filters, row actions and one-time credentials. */
export function UsersPage() {
  const t = useTranslations("Users");
  const { can } = useAuth();
  if (!can("user.manage")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess permission="user.manage" />
      </>
    );
  }
  return <UsersManager />;
}

function UsersManager() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  const branchName = useBranchName();
  const wide = useWideLayout();
  const { user: me, can } = useAuth();

  const [filters, setFilters] = useUrlState(FILTER_KEYS);
  const [search, setSearch] = useState(filters.q);
  const pushSearch = useDebouncedCallback((q: string) => setFilters({ q: q.trim(), page: "" }));
  const page = Math.max(1, Number(filters.page) || 1);
  const query = {
    q: filters.q || undefined,
    role: filters.role || undefined,
    branchId: filters.branch || undefined,
    status: filters.status || undefined,
    page,
    pageSize: USERS_PAGE_SIZE,
  };

  const users = useQuery({
    queryKey: ["users", "list", query],
    queryFn: () => api<Page<UserView>>("/users", { query }),
    placeholderData: keepPreviousData,
  });
  const branches = useQuery({ queryKey: ["branches", "options"], queryFn: () => api<BranchOption[]>("/branches/options") });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserView | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; user: UserView } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [credentials, setCredentials] = useState<IssuedCredentials[] | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });
  /** Runs an action, reporting failures as a toast (and rethrowing so dialogs stay open). */
  const run = async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (e) {
      toast.error(message(e));
      throw e;
    }
  };
  const post = <T,>(u: UserView, path: string) => api<T>(`/users/${u.id}/${path}`, { method: "POST" });
  const patch = (u: UserView, json: Partial<UserView>) => api<UserView>(`/users/${u.id}`, { method: "PATCH", json });

  const confirmAction: Record<ConfirmKind, (u: UserView) => Promise<unknown>> = {
    resetPassword: async (u) => setCredentials([await post<IssuedCredentials>(u, "reset-password")]),
    resetShowroom: async (u) => setCredentials([await post<IssuedCredentials>(u, "reset-showroom-password")]),
    reset2fa: async (u) => {
      await post<UserView>(u, "reset-2fa");
      toast.success(t("Users.reset2faDone"));
      await refresh();
    },
    deactivate: async (u) => {
      await patch(u, { isActive: false });
      toast.success(t("Users.deactivated"));
      await refresh();
    },
    delete: async (u) => {
      await api<void>(`/users/${u.id}`, { method: "DELETE" });
      toast.success(t("Users.deleted"));
      await refresh();
    },
  };

  const onAction = (kind: RowAction, u: UserView) => {
    switch (kind) {
      case "edit":
        setEditing(u);
        setEditOpen(true);
        return;
      case "unlock":
        void run(async () => {
          await post<UserView>(u, "unlock");
          toast.success(t("Users.unlocked"));
          await refresh();
        }).catch(() => undefined);
        return;
      case "activate":
        void run(async () => {
          await patch(u, { isActive: true });
          toast.success(t("Users.activated"));
          await refresh();
        }).catch(() => undefined);
        return;
      default:
        setConfirm({ kind, user: u });
        setConfirmOpen(true);
    }
  };

  const confirmCopy = confirm && {
    resetPassword: { title: t("Users.resetPassword"), body: t("Users.resetPasswordBody", { name: isolate(confirm.user.displayName) }), label: t("Users.resetPassword") },
    resetShowroom: { title: t("Users.resetShowroom"), body: t("Users.resetShowroomBody"), label: t("Users.resetShowroom") },
    reset2fa: { title: t("Users.reset2fa"), body: t("Users.reset2faBody", { name: isolate(confirm.user.displayName) }), label: t("Users.reset2fa") },
    deactivate: { title: t("Users.deactivate"), body: t("Users.deactivateBody", { name: isolate(confirm.user.displayName) }), label: t("Users.deactivate") },
    delete: { title: t("Users.delete"), body: t("Users.deleteBody", { name: isolate(confirm.user.displayName) }), label: t("Users.delete") },
  }[confirm.kind];

  const statusOptions = [
    { value: "", label: t("Users.anyStatus") },
    { value: "active", label: t("Users.active") },
    { value: "inactive", label: t("Users.inactive") },
  ];
  const roleOptions = [{ value: "", label: t("Users.anyRole") }, ...ROLES.map((r) => ({ value: r, label: t(`Common.roles.${r}`) }))];
  const branchOptions = [{ value: "", label: t("Common.anyBranch") }, ...(branches.data ?? []).map((b) => ({ value: b.id, label: branchName(b) }))];

  const data = users.data;
  const rowProps = (u: UserView) => ({
    user: u,
    isSelf: u.id === me?.id,
    canManagePermissions: can("permission.manage"),
    onAction,
  });

  return (
    <>
      <PageHeader
        title={t("Users.title")}
        subtitle={t("Users.subtitle")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus aria-hidden="true" />
            {t("Users.add")}
          </Button>
        }
      />

      <div role="search" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_repeat(3,11rem)]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              pushSearch(e.target.value);
            }}
            placeholder={t("Users.search")}
            aria-label={t("Users.search")}
            className="ps-10"
          />
        </div>
        <FilterSelect label={t("Users.role")} value={filters.role} onChange={(role) => setFilters({ role, page: "" })} options={roleOptions} />
        <FilterSelect label={t("Users.branch")} value={filters.branch} onChange={(branch) => setFilters({ branch, page: "" })} options={branchOptions} />
        <FilterSelect label={t("Users.status")} value={filters.status} onChange={(status) => setFilters({ status, page: "" })} options={statusOptions} />
      </div>

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {data ? t("Common.resultsCount", { count: data.total }) : null}
      </p>

      {users.isPending ? (
        <LoadingRows rows={6} className="h-16" />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState title={t("Users.empty")} />
      ) : data ? (
        <div className={cn("transition-opacity", users.isPlaceholderData && "opacity-60")}>
          {wide ? (
            <div className="rounded-[var(--radius-brand-lg)] border border-line">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 font-bold text-ink-2">{t("Users.name")}</TableHead>
                    <TableHead className="font-bold text-ink-2">{t("Users.username")}</TableHead>
                    <TableHead className="font-bold text-ink-2">{t("Users.role")}</TableHead>
                    <TableHead className="font-bold text-ink-2">{t("Users.branch")}</TableHead>
                    <TableHead className="font-bold text-ink-2">{t("Users.status")}</TableHead>
                    <TableHead className="font-bold text-ink-2">{t("Users.lastLogin")}</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">{t("Common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((u) => (
                    <TableRow key={u.id} className="border-line">
                      <TableCell className="max-w-[240px] px-4 py-3">
                        <NameCell user={u} isSelf={u.id === me?.id} />
                      </TableCell>
                      <TableCell>
                        <span dir="ltr" className="font-mono text-[13px]">
                          {u.username}
                        </span>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={u.role} />
                      </TableCell>
                      <TableCell className="text-[15px] text-ink-2">{u.branch ? branchName(u.branch) : "—"}</TableCell>
                      <TableCell className="whitespace-normal">
                        <StatusPills user={u} />
                      </TableCell>
                      <TableCell className="text-[15px] text-ink-2">
                        <LastLogin value={u.lastLoginAt} />
                      </TableCell>
                      <TableCell className="pe-3 text-end">
                        <UserActions {...rowProps(u)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <ul className="grid gap-3">
              {data.items.map((u) => (
                <li key={u.id} className="rounded-[var(--radius-brand-lg)] border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <NameCell user={u} isSelf={u.id === me?.id} />
                      <p className="truncate text-[13px] text-muted">
                        <span dir="ltr" className="font-mono">
                          {u.username}
                        </span>
                      </p>
                    </div>
                    <UserActions {...rowProps(u)} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={u.role} />
                    {u.branch && <Pill>{branchName(u.branch)}</Pill>}
                    <StatusPills user={u} />
                  </div>
                  <p className="mt-2 text-[13px] text-muted">
                    {t("Users.lastLogin")}: <LastLogin value={u.lastLoginAt} />
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Pagination page={page} pageSize={USERS_PAGE_SIZE} total={data.total} onPageChange={(p) => setFilters({ page: p > 1 ? String(p) : "" })} />
        </div>
      ) : null}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(c) => {
          setCreateOpen(false);
          setCredentials([c]);
          toast.success(t("Users.created"));
          void refresh();
        }}
      />
      <EditUserSheet user={editing} open={editOpen} isSelf={editing?.id === me?.id} onOpenChange={setEditOpen} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmCopy?.title}
        body={confirmCopy?.body}
        confirmLabel={confirmCopy?.label}
        destructive={confirm?.kind === "delete"}
        onConfirm={() => (confirm ? run(() => confirmAction[confirm.kind](confirm.user)) : Promise.resolve())}
      />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}

function NameCell({ user, isSelf }: { user: UserView; isSelf: boolean }) {
  const t = useTranslations("Users");
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 font-bold">
        <span dir="auto" className="truncate">
          {user.displayName}
        </span>
        {isSelf && <Pill>{t("you")}</Pill>}
      </p>
      {user.email && (
        <p className="truncate text-[13px] text-ink-2">
          <span dir="ltr">{user.email}</span>
        </p>
      )}
    </div>
  );
}

function StatusPills({ user }: { user: UserView }) {
  const t = useTranslations("Users");
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {user.isActive ? (
        <Pill>
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          {t("active")}
        </Pill>
      ) : (
        <Pill tone="warning">{t("inactive")}</Pill>
      )}
      {user.locked && (
        <Pill tone="danger">
          <Lock className="size-3.5" strokeWidth={2} aria-hidden="true" />
          {t("locked")}
        </Pill>
      )}
      {user.twoFactorEnabled && (
        <Pill tone="success">
          <ShieldCheck className="size-3.5" strokeWidth={2} aria-hidden="true" />
          {t("twoFactorOn")}
        </Pill>
      )}
    </span>
  );
}

function LastLogin({ value }: { value: string | null }) {
  const t = useTranslations("Users");
  const locale = useLocale();
  if (!value) return <span className="text-muted">{t("never")}</span>;
  return (
    <time dateTime={value} title={formatDateTime(value, locale)}>
      {formatRelative(value, locale)}
    </time>
  );
}

type RowAction = "edit" | "unlock" | "activate" | ConfirmKind;

function UserActions({
  user,
  isSelf,
  canManagePermissions,
  onAction,
}: {
  user: UserView;
  isSelf: boolean;
  canManagePermissions: boolean;
  onAction: (kind: RowAction, user: UserView) => void;
}) {
  const t = useTranslations("Users");
  const common = useTranslations("Common");
  const staff = isBranchStaff(user);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("actionsFor", { name: user.displayName })}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-56 p-1.5 [&_[role=menuitem]]:min-h-10 [&_[role=menuitem]]:px-2.5 [&_[role=menuitem]]:text-[15px]">
        <DropdownMenuItem onSelect={() => onAction("edit", user)}>
          <Pencil aria-hidden="true" />
          {common("edit")}
        </DropdownMenuItem>
        {!isSelf && (
          <DropdownMenuItem onSelect={() => onAction("resetPassword", user)}>
            <KeyRound aria-hidden="true" />
            {t("resetPassword")}
          </DropdownMenuItem>
        )}
        {staff && (
          <DropdownMenuItem onSelect={() => onAction("resetShowroom", user)}>
            <Store aria-hidden="true" />
            {t("resetShowroom")}
          </DropdownMenuItem>
        )}
        {user.twoFactorEnabled && !isSelf && (
          <DropdownMenuItem onSelect={() => onAction("reset2fa", user)}>
            <ShieldOff aria-hidden="true" />
            {t("reset2fa")}
          </DropdownMenuItem>
        )}
        {user.locked && (
          <DropdownMenuItem onSelect={() => onAction("unlock", user)}>
            <LockOpen aria-hidden="true" />
            {t("unlock")}
          </DropdownMenuItem>
        )}
        {canManagePermissions && (
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/permissions?tab=users&user=${user.id}`}>
              <ShieldCheck aria-hidden="true" />
              {t("permissions")}
            </Link>
          </DropdownMenuItem>
        )}
        {!isSelf && (
          <>
            <DropdownMenuSeparator />
            {user.isActive ? (
              <DropdownMenuItem onSelect={() => onAction("deactivate", user)}>
                <UserX aria-hidden="true" />
                {t("deactivate")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onAction("activate", user)}>
                <UserCheck aria-hidden="true" />
                {t("activate")}
              </DropdownMenuItem>
            )}
            {!staff && (
              <DropdownMenuItem variant="destructive" onSelect={() => onAction("delete", user)}>
                <Trash2 aria-hidden="true" />
                {t("delete")}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
