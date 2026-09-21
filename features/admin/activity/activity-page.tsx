"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Pill, RoleBadge } from "@/components/app/badges";
import { CopyButton } from "@/components/app/copy-button";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { EmptyState, ErrorState, LoadingRows, NoAccess } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api/client";
import type { ActivityEntry, BranchOption, Page } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { msgKey } from "@/lib/i18n/keys";
import { base } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { FilterSelect, useBranchName, useWideLayout } from "../shared/ui";
import { useDebouncedCallback, useUrlState } from "../shared/url-state";
import { changedKeys, jsonLines } from "./diff";

export const ACTIVITY_PAGE_SIZE = 25;
const FILTER_KEYS = ["action", "outcome", "actor", "branch", "entity", "from", "to", "page"] as const;
/** Prefix filters ("order." matches every order action). */
export const ACTION_GROUPS = ["auth", "account", "user", "branch", "permission", "product", "order"] as const;
export const ENTITY_TYPES = ["Order", "Product", "User", "Branch", "Role", "Session"] as const;

/** Read-only audit trail with filters and expandable before/after details. */
export function ActivityPage() {
  const t = useTranslations("Activity");
  const { can } = useAuth();
  if (!can("activity.read")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess permission="activity.read" />
      </>
    );
  }
  return <ActivityLog />;
}

function useActionLabel() {
  const t = useTranslations("Activity");
  return (action: string) => {
    const key = `actions.${msgKey(action)}`;
    return t.has(key) ? t(key) : action;
  };
}

function ActivityLog() {
  const t = useTranslations();
  const branchName = useBranchName();
  const actionLabel = useActionLabel();
  const wide = useWideLayout();
  const [filters, setFilters] = useUrlState(FILTER_KEYS);
  const [actor, setActor] = useState(filters.actor);
  const pushActor = useDebouncedCallback((value: string) => setFilters({ actor: value.trim(), page: "" }));
  const page = Math.max(1, Number(filters.page) || 1);
  const query = {
    action: filters.action || undefined,
    outcome: filters.outcome || undefined,
    actor: filters.actor || undefined,
    branchId: filters.branch || undefined,
    entityType: filters.entity || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page,
    pageSize: ACTIVITY_PAGE_SIZE,
  };

  const log = useQuery({
    queryKey: ["activity", "list", query],
    queryFn: () => api<Page<ActivityEntry>>("/activity", { query }),
    placeholderData: keepPreviousData,
  });
  const actions = useQuery({ queryKey: ["activity", "actions"], queryFn: () => api<string[]>("/activity/actions"), staleTime: Infinity });
  const branches = useQuery({ queryKey: ["branches", "options"], queryFn: () => api<BranchOption[]>("/branches/options") });

  const set = (patch: Partial<Record<(typeof FILTER_KEYS)[number], string>>) => setFilters({ ...patch, page: "" });
  const filtered = FILTER_KEYS.some((k) => k !== "page" && filters[k]);
  const clear = () => {
    setActor("");
    setFilters(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])));
  };

  const data = log.data;

  return (
    <>
      <PageHeader title={t("Activity.title")} subtitle={t("Activity.subtitle")} />

      <div role="search" className="mb-4 grid gap-3 rounded-[var(--radius-brand-lg)] border border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          showLabel
          label={t("Activity.action")}
          value={filters.action}
          onChange={(action) => set({ action })}
          options={[{ value: "", label: t("Activity.anyAction") }]}
          className="sm:col-span-2"
        >
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>{t("Activity.groupsLabel")}</SelectLabel>
            {ACTION_GROUPS.map((g) => (
              <SelectItem key={g} value={`${g}.`}>
                {t(`Activity.actionGroups.${g}`)}
              </SelectItem>
            ))}
          </SelectGroup>
          {actions.data && actions.data.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>{t("Activity.actionsLabel")}</SelectLabel>
                {actions.data.map((a) => (
                  <SelectItem key={a} value={a}>
                    {actionLabel(a)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
        </FilterSelect>
        <FilterSelect
          showLabel
          label={t("Activity.result")}
          value={filters.outcome}
          onChange={(outcome) => set({ outcome })}
          options={[
            { value: "", label: t("Activity.anyOutcome") },
            { value: "SUCCESS", label: t("Activity.success") },
            { value: "FAILURE", label: t("Activity.failure") },
          ]}
        />
        <TextFilter
          label={t("Activity.userFilter")}
          value={actor}
          placeholder={t("Activity.anyUser")}
          onChange={(value) => {
            setActor(value);
            pushActor(value);
          }}
        />
        <FilterSelect
          showLabel
          label={t("Common.branch")}
          value={filters.branch}
          onChange={(branch) => set({ branch })}
          options={[{ value: "", label: t("Common.anyBranch") }, ...(branches.data ?? []).map((b) => ({ value: b.id, label: branchName(b) }))]}
        />
        <FilterSelect
          showLabel
          label={t("Activity.entityFilter")}
          value={filters.entity}
          onChange={(entity) => set({ entity })}
          options={[{ value: "", label: t("Activity.anyEntity") }, ...ENTITY_TYPES.map((e) => ({ value: e, label: t(`Activity.entityTypes.${e}`) }))]}
        />
        <DateFilter label={t("Common.dateFrom")} value={filters.from} max={filters.to} onChange={(from) => set({ from })} />
        <DateFilter label={t("Common.dateTo")} value={filters.to} min={filters.from} onChange={(to) => set({ to })} />
        <div className="flex items-end sm:col-span-2 lg:col-span-4 lg:justify-end">
          <Button variant="ghost" onClick={clear} disabled={!filtered}>
            <X aria-hidden="true" />
            {t("Common.clearFilters")}
          </Button>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {data ? t("Common.resultsCount", { count: data.total }) : null}
      </p>

      {log.isPending ? (
        <LoadingRows rows={8} className="h-14" />
      ) : log.isError ? (
        <ErrorState error={log.error} onRetry={() => void log.refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState title={t("Activity.empty")} />
      ) : data ? (
        <div className={cn("transition-opacity", log.isPlaceholderData && "opacity-60")}>
          {wide ? (
            <div className="rounded-[var(--radius-brand-lg)] border border-line">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="border-line hover:bg-transparent">
                    <TableHead className="w-12">
                      <span className="sr-only">{t("Common.details")}</span>
                    </TableHead>
                    <TableHead className="w-[19%] font-bold text-ink-2">{t("Activity.when")}</TableHead>
                    <TableHead className="w-[17%] font-bold text-ink-2">{t("Activity.who")}</TableHead>
                    <TableHead className="font-bold text-ink-2">{t("Activity.action")}</TableHead>
                    <TableHead className="w-[15%] font-bold text-ink-2">{t("Activity.target")}</TableHead>
                    <TableHead className="w-[13%] font-bold text-ink-2">{t("Common.branch")}</TableHead>
                    <TableHead className="w-[11%] font-bold text-ink-2">{t("Activity.ip")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <ul className="grid gap-3">
              {data.items.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
          <Pagination page={page} pageSize={ACTIVITY_PAGE_SIZE} total={data.total} onPageChange={(p) => setFilters({ page: p > 1 ? String(p) : "" })} />
        </div>
      ) : null}
    </>
  );
}

function TextFilter({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} dir="auto" autoCapitalize="none" spellCheck={false} />
    </div>
  );
}

function DateFilter({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} min={min || undefined} max={max || undefined} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ---- one entry -------------------------------------------------------------

function When({ at }: { at: string }) {
  const locale = useLocale();
  return (
    <time dateTime={at} className="grid">
      <span className="text-[14px] font-semibold text-ink">{formatDateTime(at, locale)}</span>
      <span className="text-[12px] text-muted">{formatRelative(at, locale)}</span>
    </time>
  );
}

function Who({ entry, stacked = false }: { entry: ActivityEntry; stacked?: boolean }) {
  const t = useTranslations("Activity");
  if (!entry.actor?.username) return <span className="text-[14px] text-muted">{t("anonymous")}</span>;
  return (
    <span className={cn("flex min-w-0 items-start gap-1.5", stacked ? "flex-col gap-1" : "flex-wrap items-center")}>
      <span dir="ltr" className="max-w-full truncate font-mono text-[13px] font-bold">
        {entry.actor.username}
      </span>
      {entry.actor.role && <RoleBadge role={entry.actor.role} />}
    </span>
  );
}

function reason(entry: ActivityEntry): string | null {
  const r = entry.metadata?.reason;
  return entry.outcome === "FAILURE" && typeof r === "string" ? r : null;
}

function ActionCell({ entry }: { entry: ActivityEntry }) {
  const t = useTranslations("Activity");
  const label = useActionLabel()(entry.action);
  const why = reason(entry);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-[15px] font-bold text-ink">{label}</span>
      {entry.outcome === "FAILURE" && <Pill tone="danger">{t("failure")}</Pill>}
      {why && (
        <span dir="ltr" className="truncate font-mono text-[12px] text-danger" title={why}>
          {why}
        </span>
      )}
    </span>
  );
}

function targetId(entry: ActivityEntry): string | null {
  const code = entry.metadata?.code;
  if (entry.entityType === "Order" && typeof code === "string") return code;
  if (!entry.entityId) return null;
  return entry.entityId.length > 12 ? entry.entityId.slice(0, 8) : entry.entityId;
}

function Target({ entry }: { entry: ActivityEntry }) {
  const t = useTranslations("Activity");
  if (!entry.entityType) return <span className="text-muted">—</span>;
  const type = t.has(`entityTypes.${entry.entityType}`) ? t(`entityTypes.${entry.entityType}`) : entry.entityType;
  const id = targetId(entry);
  return (
    <span className="grid min-w-0">
      <span className="text-[14px] text-ink">{type}</span>
      {id && (
        <span className="truncate text-[12px] text-muted" title={entry.entityId ?? undefined}>
          <span dir="ltr" className="font-mono">
            {id}
          </span>
        </span>
      )}
    </span>
  );
}

function DisclosureButton({ open, controls, onToggle }: { open: boolean; controls: string; onToggle: () => void }) {
  const t = useTranslations("Common");
  return (
    <Button variant="ghost" size="icon-sm" aria-expanded={open} aria-controls={controls} onClick={onToggle} aria-label={t("details")}>
      <ChevronDown className={cn("transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
    </Button>
  );
}

function Expand({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={base}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EntryRow({ entry }: { entry: ActivityEntry }) {
  const branchName = useBranchName();
  const [open, setOpen] = useState(false);
  const detailsId = `activity-${entry.id}`;
  return (
    <>
      <TableRow className={cn("border-line", open && "border-b-0 bg-sand/60")}>
        <TableCell className="ps-3 align-top">
          <DisclosureButton open={open} controls={detailsId} onToggle={() => setOpen((o) => !o)} />
        </TableCell>
        <TableCell className="py-2.5 align-top whitespace-normal">
          <When at={entry.occurredAt} />
        </TableCell>
        <TableCell className="py-2.5 align-top whitespace-normal">
          <Who entry={entry} stacked />
        </TableCell>
        <TableCell className="py-2.5 align-top whitespace-normal">
          <ActionCell entry={entry} />
        </TableCell>
        <TableCell className="py-2.5 align-top whitespace-normal">
          <Target entry={entry} />
        </TableCell>
        <TableCell className="py-2.5 align-top text-[14px] whitespace-normal text-ink-2">{entry.branch ? branchName(entry.branch) : "—"}</TableCell>
        <TableCell className="py-2.5 align-top text-[13px] text-ink-2">
          <span dir="ltr" className="block truncate font-mono" title={entry.ip ?? undefined}>
            {entry.ip ?? "—"}
          </span>
        </TableCell>
      </TableRow>
      <tr id={detailsId} className={cn(open && "border-b border-line bg-sand/60")}>
        <td colSpan={7} className="p-0">
          <Expand open={open}>
            <Details entry={entry} />
          </Expand>
        </td>
      </tr>
    </>
  );
}

function EntryCard({ entry }: { entry: ActivityEntry }) {
  const branchName = useBranchName();
  const [open, setOpen] = useState(false);
  const detailsId = `activity-${entry.id}`;
  return (
    <li className="rounded-[var(--radius-brand-lg)] border border-line bg-surface">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="grid min-w-0 gap-1.5">
          <ActionCell entry={entry} />
          <Who entry={entry} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
            <Target entry={entry} />
            {entry.branch && <span>{branchName(entry.branch)}</span>}
          </div>
          <When at={entry.occurredAt} />
        </div>
        <DisclosureButton open={open} controls={detailsId} onToggle={() => setOpen((o) => !o)} />
      </div>
      <div id={detailsId}>
        <Expand open={open}>
          <div className="border-t border-line">
            <Details entry={entry} />
          </div>
        </Expand>
      </div>
    </li>
  );
}

// ---- details panel ---------------------------------------------------------

function Details({ entry }: { entry: ActivityEntry }) {
  const t = useTranslations("Activity");
  const changed = new Set(changedKeys(entry.before, entry.after));
  const hasSnapshots = entry.before != null || entry.after != null;
  return (
    <div className="grid gap-4 p-4">
      {hasSnapshots && (
        <div className="grid gap-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <JsonBlock title={t("before")} value={entry.before} changed={changed} tone="before" />
            <JsonBlock title={t("after")} value={entry.after} changed={changed} tone="after" />
          </div>
          {changed.size > 0 && <p className="text-[12px] text-muted">{t("changedHint")}</p>}
        </div>
      )}
      {entry.metadata && Object.keys(entry.metadata).length > 0 && <JsonBlock title={t("metadata")} value={entry.metadata} />}
      <dl className="grid gap-3 text-[13px] sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <dt className="font-bold text-muted">{t("ip")}</dt>
          <dd className="truncate">
            <span dir="ltr" className="font-mono">
              {entry.ip ?? "—"}
            </span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-bold text-muted">{t("device")}</dt>
          <dd className="truncate" title={entry.userAgent ?? undefined}>
            <span dir="ltr">{entry.userAgent ?? "—"}</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-bold text-muted">{t("requestId")}</dt>
          <dd className="flex min-w-0 items-center gap-2">
            {entry.requestId ? (
              <>
                <span dir="ltr" className="truncate font-mono">
                  {entry.requestId}
                </span>
                <CopyButton value={entry.requestId} />
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function JsonBlock({ title, value, changed, tone }: { title: string; value: unknown; changed?: Set<string>; tone?: "before" | "after" }) {
  const t = useTranslations("Activity");
  const lines = value === null || value === undefined ? [] : jsonLines(value);
  const id = useId();
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-[var(--radius-brand)] border border-line bg-surface">
      <h4 id={id} className="border-b border-line px-3 py-1.5 text-[13px] font-bold text-ink-2">
        {title}
      </h4>
      {lines.length === 0 ? (
        <p className="px-3 py-2 text-[13px] text-muted">{t("noValue")}</p>
      ) : (
        <pre dir="ltr" className="max-h-80 overflow-auto p-2 text-start font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
          {lines.map((line, i) => {
            const hit = line.key !== null && changed?.has(line.key);
            return (
              <span
                key={i}
                className={cn("block rounded-[4px] px-1.5", hit && (tone === "before" ? "bg-danger-soft" : "bg-success-soft"))}
                data-changed={hit || undefined}
              >
                {line.text}
                {hit && <span className="sr-only"> ({t("changed")})</span>}
              </span>
            );
          })}
        </pre>
      )}
    </section>
  );
}
