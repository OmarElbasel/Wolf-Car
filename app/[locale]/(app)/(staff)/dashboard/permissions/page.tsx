import { Suspense } from "react";
import { LoadingRows } from "@/components/app/states";
import { PermissionsPage } from "@/features/admin/permissions/permissions-page";

export default function Page() {
  return (
    <Suspense fallback={<LoadingRows rows={6} className="h-16" />}>
      <PermissionsPage />
    </Suspense>
  );
}
