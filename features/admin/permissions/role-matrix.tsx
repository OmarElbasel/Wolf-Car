"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { ErrorState, LoadingRows } from "@/components/app/states";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import type { PermissionInfo, PermissionKey, RoleMatrix as Matrix, RoleName } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { msgKey } from "@/lib/i18n/keys";
import { cn } from "@/lib/utils";
import { ROLES } from "@/shared/permissions";
import { groupCatalog, PermissionLabel, sameSet, UnsavedBar } from "./shared";

export const MATRIX_KEY = ["roles", "permissions"] as const;

/**
 * Permissions × roles. Checkboxes edit a local draft; only the roles that
 * differ from the server are sent (PUT /roles/:role/permissions, full list).
 */
export function RoleMatrix({ catalog }: { catalog: PermissionInfo[] }) {
  const t = useTranslations();
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const matrix = useQuery({ queryKey: MATRIX_KEY, queryFn: () => api<Matrix>("/roles/permissions") });
  const [draft, setDraft] = useState<Partial<Record<RoleName, PermissionKey[]>>>({});
  const [saving, setSaving] = useState(false);

  if (matrix.isPending) return <LoadingRows rows={8} className="h-12" />;
  if (matrix.isError) return <ErrorState error={matrix.error} onRetry={() => void matrix.refetch()} />;

  const server = matrix.data;
  const locked = new Set(server.locked);
  const order = catalog.map((p) => p.key);
  const current = (role: RoleName) => draft[role] ?? server.roles[role] ?? [];
  const changed = ROLES.filter((r) => !locked.has(r) && draft[r] && !sameSet(draft[r], server.roles[r] ?? []));

  const toggle = (role: RoleName, key: PermissionKey, on: boolean) => {
    const set = new Set(current(role));
    if (on) set.add(key);
    else set.delete(key);
    const next = order.filter((k) => set.has(k));
    setDraft((d) => {
      const copy = { ...d };
      if (sameSet(next, server.roles[role] ?? [])) delete copy[role];
      else copy[role] = next;
      return copy;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const role of changed) {
        const res = await api<{ role: RoleName; permissions: PermissionKey[] }>(`/roles/${role}/permissions`, {
          method: "PUT",
          json: { permissions: current(role) },
        });
        // keep what was saved even if a later role fails
        queryClient.setQueryData<Matrix>(MATRIX_KEY, (old) => (old ? { ...old, roles: { ...old.roles, [role]: res.permissions } } : old));
      }
      setDraft({});
      toast.success(t("Permissions.saved"));
      void queryClient.invalidateQueries({ queryKey: MATRIX_KEY });
      void queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
    } catch (e) {
      toast.error(message(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius-brand-lg)] border border-line">
        <Table className="min-w-[540px] sm:min-w-[680px]">
          <TableHeader>
            <TableRow className="border-line hover:bg-transparent">
              <TableHead className="sticky start-0 z-10 h-12 min-w-[160px] bg-surface px-4 font-bold text-ink-2 sm:min-w-[220px]">{t("Permissions.permission")}</TableHead>
              {ROLES.map((role) => (
                <TableHead key={role} className="h-12 w-[19%] text-center font-bold whitespace-normal text-ink sm:w-[16%]">
                  <span className="inline-flex items-center gap-1.5">
                    {t(`Common.roles.${role}`)}
                    {locked.has(role) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="grid size-7 place-items-center rounded-[6px] text-muted hover:bg-sand hover:text-ink" aria-label={t("Permissions.locked")}>
                            <Lock className="size-4" strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("Permissions.locked")}</TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupCatalog(catalog).map(({ group, permissions }) => (
              <Fragment key={group}>
                <TableRow className="border-line bg-sand hover:bg-sand">
                  <TableHead colSpan={ROLES.length + 1} scope="colgroup" className="h-9 p-0 text-[13px] font-extrabold tracking-wide text-ink-2">
                    <span className="sticky start-0 inline-block px-4">{t(`Permissions.groups.${group}`)}</span>
                  </TableHead>
                </TableRow>
                {permissions.map((info) => (
                  <TableRow key={info.key} className="border-line hover:bg-transparent">
                    <TableHead scope="row" className="sticky start-0 z-10 h-auto bg-surface px-4 py-2.5 whitespace-normal">
                      <PermissionLabel info={info} />
                    </TableHead>
                    {ROLES.map((role) => {
                      const isLocked = locked.has(role);
                      const checked = isLocked || current(role).includes(info.key);
                      const edited = !isLocked && checked !== (server.roles[role] ?? []).includes(info.key);
                      return (
                        <TableCell key={role} className={cn("text-center transition-colors", edited && "bg-warning-soft")}>
                          <Checkbox
                            checked={checked}
                            disabled={isLocked || saving}
                            onCheckedChange={(v) => toggle(role, info.key, v === true)}
                            aria-label={`${t(`Permissions.labels.${msgKey(info.key)}`)} — ${t(`Common.roles.${role}`)}`}
                            className="mx-auto size-5"
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <UnsavedBar dirty={changed.length > 0} saving={saving} onSave={() => void save()} onDiscard={() => setDraft({})} />
    </>
  );
}
