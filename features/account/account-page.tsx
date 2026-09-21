"use client";

import { UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { RoleBadge } from "@/components/app/badges";
import { PageHeader } from "@/components/app/page-header";
import { useAuth } from "@/features/auth/auth-provider";
import type { Profile } from "@/lib/api/types";
import { AccountCard } from "./account-card";
import { ChangePasswordCard, ShowroomPasswordCard } from "./password-cards";
import { TwoFactorCard } from "./two-factor";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-line py-2.5 last:border-b-0 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[13px] font-bold text-muted sm:text-sm sm:leading-7">{label}</dt>
      <dd className="min-w-0 text-[15px] font-semibold">{children}</dd>
    </div>
  );
}

function ProfileCard({ user }: { user: Profile }) {
  const t = useTranslations("Account");
  const locale = useLocale();
  const branch = user.branch ? (locale === "ar" ? user.branch.nameAr : user.branch.name) : null;
  return (
    <AccountCard icon={UserRound} title={t("profile")}>
      <dl>
        <Row label={t("fields.displayName")}>
          <span dir="auto">{user.displayName}</span>
        </Row>
        <Row label={t("fields.username")}>
          <span dir="ltr" className="font-mono">
            {user.username}
          </span>
        </Row>
        <Row label={t("fields.role")}>
          <RoleBadge role={user.role} />
        </Row>
        <Row label={t("fields.branch")}>
          {branch ? (
            <span dir="auto">
              {branch}{" "}
              <span dir="ltr" className="font-mono text-[13px] text-muted">
                ({user.branch?.code})
              </span>
            </span>
          ) : (
            <span className="text-muted">{t("fields.noBranch")}</span>
          )}
        </Row>
        <Row label={t("fields.email")}>
          {user.email ? (
            <span dir="ltr" className="break-all">
              {user.email}
            </span>
          ) : (
            <span className="text-muted">{t("fields.noEmail")}</span>
          )}
        </Row>
      </dl>
    </AccountCard>
  );
}

/** Every signed-in staff user: profile, passwords and two-step verification. */
export function AccountPage() {
  const t = useTranslations("Account");
  const { user, can } = useAuth();
  if (!user) return null;
  const showroom = Boolean(user.branch) && can("showroom.password.view_or_change");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="grid gap-5">
          <ProfileCard user={user} />
          <TwoFactorCard />
        </div>
        <div className="grid gap-5">
          <ChangePasswordCard />
          {showroom && <ShowroomPasswordCard />}
        </div>
      </div>
    </>
  );
}
