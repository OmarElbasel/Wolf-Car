import { Suspense } from "react";
import { LoadingRows } from "@/components/app/states";
import { OrdersPage } from "@/features/orders/orders-page";

export default function Orders() {
  return (
    // filters and the open order live in the query string (useSearchParams)
    <Suspense fallback={<LoadingRows rows={8} className="h-14" />}>
      <OrdersPage />
    </Suspense>
  );
}
