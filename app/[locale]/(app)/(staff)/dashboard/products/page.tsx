import { Suspense } from "react";
import { LoadingRows } from "@/components/app/states";
import { ProductsPage } from "@/features/products/products-page";

export default function Products() {
  return (
    // the page reads ?price= (useSearchParams)
    <Suspense fallback={<LoadingRows rows={6} className="h-[82px]" />}>
      <ProductsPage />
    </Suspense>
  );
}
