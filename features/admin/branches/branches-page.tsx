"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/app/badges";
import { CredentialsDialog } from "@/components/app/credentials-dialog";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api/client";
import type { BranchView, IssuedCredentials, StaffRef } from "@/lib/api/types";
import { NoAccess } from "../shared/ui";
import { CreateBranchSheet, EditBranchSheet, ReplaceStaffDialog, type ReplaceTarget, SLOT_ROLE, type StaffSlot } from "./branch-forms";

/** Super Admin: branches with their one manager and one cashier. */
export function BranchesPage() {
  const t = useTranslations("Branches");
  const { can } = useAuth();
  if (!can("branch.manage")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess permission="branch.manage" />
      </>
    );
  }
  return <BranchesManager />;
}

function BranchesManager() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const branches = useQuery({ queryKey: ["branches"], queryFn: () => api<BranchView[]>("/branches") });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BranchView | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [replacing, setReplacing] = useState<ReplaceTarget | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [credentials, setCredentials] = useState<IssuedCredentials[] | null>(null);

  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["branches"] }), queryClient.invalidateQueries({ queryKey: ["users"] })]);

  return (
    <>
      <PageHeader
        title={t("Branches.title")}
        subtitle={t("Branches.subtitle")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            {t("Branches.add")}
          </Button>
        }
      />

      {branches.isPending ? (
        <LoadingRows rows={2} className="h-56" />
      ) : branches.isError ? (
        <ErrorState error={branches.error} onRetry={() => void branches.refetch()} />
      ) : branches.data.length === 0 ? (
        <EmptyState title={t("Branches.empty")} />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {branches.data.map((b) => (
            <li key={b.id}>
              <BranchCard
                branch={b}
                onEdit={() => {
                  setEditing(b);
                  setEditOpen(true);
                }}
                onReplace={(slot) => {
                  setReplacing({ branch: b, slot });
                  setReplaceOpen(true);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <CreateBranchSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(issued) => {
          setCreateOpen(false);
          setCredentials(issued);
          toast.success(t("Branches.created"));
          void refresh();
        }}
      />
      <EditBranchSheet branch={editing} open={editOpen} onOpenChange={setEditOpen} />
      <ReplaceStaffDialog
        target={replacing}
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        onReplaced={(issued, target) => {
          setReplaceOpen(false);
          setCredentials([issued]);
          toast.success(t("Branches.replaced", { role: t(`Common.roles.${SLOT_ROLE[target.slot]}`) }));
          void refresh();
        }}
      />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}

function BranchCard({ branch, onEdit, onReplace }: { branch: BranchView; onEdit: () => void; onReplace: (slot: StaffSlot) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const [primary, secondary] = locale === "ar" ? [branch.nameAr, branch.name] : [branch.name, branch.nameAr];
  const headingId = `branch-${branch.id}`;
  return (
    <article aria-labelledby={headingId} className="h-full rounded-[var(--radius-brand-lg)] border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span dir="ltr" className="shrink-0 rounded-[8px] bg-charcoal px-2.5 py-1.5 font-mono text-[15px] leading-none font-bold tracking-[0.08em] text-white dark:bg-[#2a2723]">
            {branch.code}
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg leading-snug font-extrabold">
              <span dir="auto">{primary}</span>
            </h2>
            <p className="text-[15px] text-ink-2">
              <span dir="auto">{secondary}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {branch.isActive ? (
            <Pill>
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              {t("Branches.active")}
            </Pill>
          ) : (
            <Pill tone="warning">{t("Branches.inactive")}</Pill>
          )}
          <Button variant="outline" size="sm" onClick={onEdit} aria-label={t("Branches.editTitle", { name: primary })}>
            <Pencil aria-hidden="true" />
            {t("Common.edit")}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <StaffBlock slot="manager" staff={branch.manager} onReplace={() => onReplace("manager")} />
        <StaffBlock slot="cashier" staff={branch.cashier} onReplace={() => onReplace("cashier")} />
      </div>
    </article>
  );
}

function StaffBlock({ slot, staff, onReplace }: { slot: StaffSlot; staff: StaffRef | null; onReplace: () => void }) {
  const t = useTranslations();
  const role = t(`Common.roles.${SLOT_ROLE[slot]}`);
  return (
    <section aria-label={role} className="flex flex-col gap-3 rounded-[var(--radius-brand)] bg-sand p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-muted">{t(slot === "manager" ? "Branches.manager" : "Branches.cashier")}</p>
        {staff ? (
          <>
            <p className="mt-1 truncate font-bold">
              <span dir="auto">{staff.displayName}</span>
            </p>
            <p className="truncate text-[13px] text-ink-2">
              <span dir="ltr" className="font-mono">
                {staff.username}
              </span>
            </p>
            <p className="truncate text-[13px] text-muted">{staff.email ? <span dir="ltr">{staff.email}</span> : t("Branches.noEmail")}</p>
          </>
        ) : (
          <p className="mt-1 text-[15px] text-muted">{t("Branches.vacant")}</p>
        )}
      </div>
      <Button variant="outline" size="sm" className="self-start bg-surface" onClick={onReplace} aria-label={t("Branches.replaceTitle", { role })}>
        <RefreshCw aria-hidden="true" />
        {t("Branches.replace")}
      </Button>
    </section>
  );
}
