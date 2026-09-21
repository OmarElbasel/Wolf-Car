"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Pill, RoleBadge } from "@/components/app/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import type { Page, PermissionInfo, PermissionKey, UserPermissions, UserView } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { cn } from "@/lib/utils";
import { useDebounced } from "../shared/url-state";
import { groupCatalog, PermissionLabel, UnsavedBar } from "./shared";

type Choice = "INHERIT" | "GRANT" | "REVOKE";
const CHOICES: Choice[] = ["INHERIT", "GRANT", "REVOKE"];

/** Per-user exceptions: pick a user, then grant or revoke single permissions on top of the role. */
export function UserOverrides({
  catalog,
  userId,
  onSelect,
}: {
  catalog: PermissionInfo[];
  userId: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("Permissions");
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <UserPicker selected={userId} onSelect={onSelect} />
      {userId ? (
        <UserPermissionsEditor key={userId} userId={userId} catalog={catalog} />
      ) : (
        <EmptyState title={t("pickUser")} body={t("pickUserHint")} />
      )}
    </div>
  );
}

function UserPicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const t = useTranslations("Permissions");
  const id = useId();
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const users = useQuery({
    queryKey: ["users", "pick", query],
    queryFn: () => api<Page<UserView>>("/users", { query: { q: query || undefined, pageSize: 10 } }),
    placeholderData: keepPreviousData,
  });
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-[var(--radius-brand-lg)] border border-line p-3 lg:sticky lg:top-[82px]">
      <h2 id={`${id}-title`} className="px-1 pb-2 font-extrabold">
        {t("pickUser")}
      </h2>
      <div className="relative">
        <Label htmlFor={id} className="sr-only">
          {t("searchUsers")}
        </Label>
        <Search className="pointer-events-none absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchUsers")} className="ps-10" />
      </div>
      {users.isPending ? (
        <div className="mt-2">
          <LoadingRows rows={4} className="h-12" />
        </div>
      ) : users.isError ? (
        <div className="mt-2">
          <ErrorState error={users.error} onRetry={() => void users.refetch()} />
        </div>
      ) : users.data.items.length === 0 ? (
        <p className="px-1 py-6 text-center text-[15px] text-muted">{t("noUsers")}</p>
      ) : (
        <ul className={cn("mt-2 grid max-h-80 gap-1 overflow-y-auto lg:max-h-[60dvh]", users.isPlaceholderData && "opacity-60")}>
          {users.data.items.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                aria-pressed={u.id === selected}
                onClick={() => onSelect(u.id)}
                className="grid min-h-11 w-full gap-0.5 rounded-[var(--radius-brand)] px-2.5 py-2 text-start transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink aria-pressed:bg-sand aria-pressed:ring-1 aria-pressed:ring-line"
              >
                <span className="flex items-center justify-between gap-2">
                  <span dir="auto" className="truncate font-bold">
                    {u.displayName}
                  </span>
                  <RoleBadge role={u.role} />
                </span>
                <span className="truncate text-[13px] text-muted">
                  <span dir="ltr" className="font-mono">
                    {u.username}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UserPermissionsEditor({ userId, catalog }: { userId: string; catalog: PermissionInfo[] }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const key = ["user-permissions", userId];
  const perms = useQuery({ queryKey: key, queryFn: () => api<UserPermissions>(`/users/${userId}/permissions`) });
  const profile = useQuery({ queryKey: ["users", "detail", userId], queryFn: () => api<UserView>(`/users/${userId}`) });
  const [edits, setEdits] = useState<Partial<Record<PermissionKey, Choice>>>({});
  const [saving, setSaving] = useState(false);

  if (perms.isPending || profile.isPending) return <LoadingRows rows={6} className="h-16" />;
  if (perms.isError || profile.isError) {
    return <ErrorState error={perms.error ?? profile.error} onRetry={() => void Promise.all([perms.refetch(), profile.refetch()])} />;
  }

  const data = perms.data;
  const user = profile.data;
  const fromServer = (p: PermissionKey): Choice => data.overrides.find((o) => o.permission === p)?.effect ?? "INHERIT";
  const choice = (p: PermissionKey): Choice => edits[p] ?? fromServer(p);
  const fromRole = (p: PermissionKey) => data.rolePermissions.includes(p);
  const effective = (p: PermissionKey) => (choice(p) === "INHERIT" ? fromRole(p) : choice(p) === "GRANT");
  const exceptions = catalog.filter((p) => choice(p.key) !== "INHERIT").length;
  const dirty = Object.keys(edits).length > 0;

  const set = (p: PermissionKey, c: Choice) =>
    setEdits((e) => {
      const copy = { ...e };
      if (c === fromServer(p)) delete copy[p];
      else copy[p] = c;
      return copy;
    });

  const save = async () => {
    setSaving(true);
    try {
      const overrides = catalog
        .map((p) => ({ permission: p.key, effect: choice(p.key) }))
        .filter((o): o is { permission: PermissionKey; effect: "GRANT" | "REVOKE" } => o.effect !== "INHERIT");
      const res = await api<UserPermissions>(`/users/${userId}/permissions`, { method: "PUT", json: { overrides } });
      queryClient.setQueryData(key, res);
      setEdits({});
      toast.success(t("Permissions.saved"));
    } catch (e) {
      toast.error(message(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="perm-user-title" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-brand-lg)] border border-line p-4">
        <div className="min-w-0">
          <h2 id="perm-user-title" className="text-lg font-extrabold">
            <span dir="auto">{user.displayName}</span>
          </h2>
          <p className="text-[13px] text-muted">
            <span dir="ltr" className="font-mono">
              {user.username}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RoleBadge role={data.role} />
          {!data.locked && <Pill tone={exceptions ? "warning" : "neutral"}>{t("Permissions.exceptions", { count: exceptions })}</Pill>}
        </div>
      </div>

      {data.locked ? (
        <div role="note" className="flex items-start gap-3 rounded-[var(--radius-brand-lg)] border border-line bg-sand p-5">
          <Lock className="mt-0.5 size-5 shrink-0 text-ink-2" strokeWidth={1.8} aria-hidden="true" />
          <p className="text-[15px] text-ink-2">{t("Permissions.userLocked")}</p>
        </div>
      ) : (
        <div className="grid gap-5">
          {groupCatalog(catalog).map(({ group, permissions }) => (
            <section key={group} aria-labelledby={`perm-group-${group}`} className="rounded-[var(--radius-brand-lg)] border border-line">
              <h3 id={`perm-group-${group}`} className="border-b border-line bg-sand px-4 py-2 text-[13px] font-extrabold tracking-wide text-ink-2">
                {t(`Permissions.groups.${group}`)}
              </h3>
              <ul className="divide-y divide-line">
                {permissions.map((info) => (
                  <PermissionRow
                    key={info.key}
                    info={info}
                    value={choice(info.key)}
                    edited={info.key in edits}
                    fromRole={fromRole(info.key)}
                    effective={effective(info.key)}
                    disabled={saving}
                    onChange={(c) => set(info.key, c)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <UnsavedBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={() => setEdits({})} />
    </section>
  );
}

function PermissionRow({
  info,
  value,
  edited,
  fromRole,
  effective,
  disabled,
  onChange,
}: {
  info: PermissionInfo;
  value: Choice;
  edited: boolean;
  fromRole: boolean;
  effective: boolean;
  disabled: boolean;
  onChange: (choice: Choice) => void;
}) {
  const t = useTranslations("Permissions");
  const id = useId();
  const labels: Record<Choice, string> = { INHERIT: t("inherit"), GRANT: t("grant"), REVOKE: t("revoke") };
  const tone: Record<Choice, string> = {
    INHERIT: "peer-checked:bg-surface peer-checked:text-ink",
    GRANT: "peer-checked:bg-success-soft peer-checked:text-success",
    REVOKE: "peer-checked:bg-danger-soft peer-checked:text-danger",
  };
  return (
    <li className={cn("grid gap-3 px-4 py-3 transition-colors md:grid-cols-[minmax(0,1fr)_auto] md:items-center", edited && "bg-warning-soft/60")}>
      <div className="grid gap-1.5">
        <PermissionLabel info={info} id={`${id}-label`} />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
          <span>{t("fromRole", { state: fromRole ? t("on") : t("off") })}</span>
          <span className="inline-flex items-center gap-1.5">
            {t("effective")}:
            <Pill tone={effective ? "success" : "neutral"}>{effective ? t("on") : t("off")}</Pill>
          </span>
        </p>
      </div>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="inline-flex w-full rounded-[var(--radius-brand)] bg-sand p-1 md:w-auto">
        {CHOICES.map((c) => (
          <label key={c} className="relative flex-1 md:flex-none">
            <input
              type="radio"
              name={`${id}-choice`}
              value={c}
              checked={value === c}
              disabled={disabled}
              onChange={() => onChange(c)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex min-h-10 cursor-pointer items-center justify-center rounded-[8px] px-3 text-sm font-bold whitespace-nowrap text-ink-2 transition-colors select-none hover:text-ink peer-checked:ring-1 peer-checked:ring-line peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
                tone[c],
              )}
            >
              {labels[c]}
            </span>
          </label>
        ))}
      </div>
    </li>
  );
}
