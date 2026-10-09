import { api } from "@/lib/api/client";
import type { PriceChange, Product } from "@/lib/api/types";

export type PriceFilter = "all" | "priced" | "unpriced";

export interface ProductListParams {
  q: string;
  price: PriceFilter;
  /** only the products under the website's "Quick service" tab */
  quick: boolean;
  /** Only for users without a branch: show this branch's showroom order. */
  branchId: string | null;
}

export const productKeys = {
  all: ["products"] as const,
  list: (params: ProductListParams) => ["products", "list", params] as const,
  history: (id: string) => ["products", "history", id] as const,
};

export function parsePriceFilter(value: string | null): PriceFilter {
  return value === "priced" || value === "unpriced" ? value : "all";
}

export function fetchProducts({ q, price, quick, branchId }: ProductListParams): Promise<Product[]> {
  return api<Product[]>("/products", {
    query: { q: q || undefined, price: price === "all" ? undefined : price, quickService: quick ? "true" : undefined, branchId: branchId ?? undefined },
  });
}

export function fetchPriceHistory(id: string): Promise<PriceChange[]> {
  return api<PriceChange[]>(`/products/${id}/price-history`);
}
