import { Suspense } from "react";
import { LoadingRows } from "@/components/app/states";
import { UsersPage } from "@/features/admin/users/users-page";

export default function Page() {
  return (
    <Suspense fallback={<LoadingRows rows={6} className="h-16" />}>
      <UsersPage />
    </Suspense>
  );
}
