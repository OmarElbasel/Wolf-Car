import { Suspense } from "react";
import { LoadingRows } from "@/components/app/states";
import { ActivityPage } from "@/features/admin/activity/activity-page";

export default function Page() {
  return (
    <Suspense fallback={<LoadingRows rows={6} className="h-16" />}>
      <ActivityPage />
    </Suspense>
  );
}
