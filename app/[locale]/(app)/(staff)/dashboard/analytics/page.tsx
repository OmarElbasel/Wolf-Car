import { Suspense } from "react";
import { LoadingRows } from "@/components/app/states";
import { AnalyticsPage } from "@/features/admin/analytics/analytics-page";

export default function Page() {
  return (
    <Suspense fallback={<LoadingRows rows={6} className="h-16" />}>
      <AnalyticsPage />
    </Suspense>
  );
}
