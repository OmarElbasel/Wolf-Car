import { Suspense } from "react";
import { LoadingRows } from "@/components/app/states";
import { BranchesPage } from "@/features/admin/branches/branches-page";

export default function Page() {
  return (
    <Suspense fallback={<LoadingRows rows={6} className="h-16" />}>
      <BranchesPage />
    </Suspense>
  );
}
