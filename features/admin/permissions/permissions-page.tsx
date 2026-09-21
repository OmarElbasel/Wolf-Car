"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/app/page-header";
import { ErrorState, LoadingRows, NoAccess } from "@/components/app/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api/client";
import type { PermissionInfo } from "@/lib/api/types";

import { useUrlState } from "../shared/url-state";
import { RoleMatrix } from "./role-matrix";
import { UserOverrides } from "./user-overrides";

const URL_KEYS = ["tab", "user"] as const;

/** Super Admin: role defaults (matrix) and per-user exceptions. */
export function PermissionsPage() {
  const t = useTranslations("Permissions");
  const { can } = useAuth();
  if (!can("permission.manage")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess permission="permission.manage" />
      </>
    );
  }
  return <PermissionsManager />;
}

function PermissionsManager() {
  const t = useTranslations("Permissions");
  const [params, setParams] = useUrlState(URL_KEYS);
  const tab = params.tab === "users" ? "users" : "roles";
  const catalog = useQuery({ queryKey: ["permissions", "catalog"], queryFn: () => api<PermissionInfo[]>("/permissions"), staleTime: Infinity });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value })} className="flex-col gap-5">
        <TabsList className="h-11 w-full sm:w-fit">
          <TabsTrigger value="roles" className="px-5">
            {t("rolesTab")}
          </TabsTrigger>
          <TabsTrigger value="users" className="px-5">
            {t("usersTab")}
          </TabsTrigger>
        </TabsList>
        {catalog.isPending ? (
          <LoadingRows rows={8} className="h-12" />
        ) : catalog.isError ? (
          <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
        ) : (
          <>
            <TabsContent value="roles" className="text-[15px]">
              <RoleMatrix catalog={catalog.data} />
            </TabsContent>
            <TabsContent value="users" className="text-[15px]">
              <UserOverrides catalog={catalog.data} userId={params.user} onSelect={(user) => setParams({ user })} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  );
}
