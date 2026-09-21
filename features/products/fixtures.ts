import type { PermissionKey, Product } from "@/lib/api/types";
import { makeUser } from "@/tests/render";

/** Test data for the products feature (not a test file itself). */
let seq = 0;
export function makeProduct(overrides: Partial<Product> = {}): Product {
  seq += 1;
  const id = overrides.id ?? `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  return {
    id,
    name: `Product ${seq}`,
    description: null,
    barcode: null,
    price: null,
    priceUpdatedAt: null,
    imageUrl: `/api/uploads/${id}.webp`,
    thumbUrl: `/api/uploads/${id}-sm.webp`,
    createdBy: { id: "u-1", displayName: "GH Manager" },
    createdAt: "2026-09-20T08:00:00.000Z",
    updatedAt: "2026-09-20T08:00:00.000Z",
    ...overrides,
  };
}

export const MANAGER_PERMISSIONS: PermissionKey[] = [
  "product.create",
  "product.update.details",
  "product.read",
  "product.reorder",
  "order.create",
  "order.read.branch",
];
export const FINANCE_PERMISSIONS: PermissionKey[] = ["product.read", "product.update.price", "order.read.all"];

export const manager = () => makeUser({ role: "BRANCH_MANAGER", permissions: MANAGER_PERMISSIONS });
export const finance = () =>
  makeUser({ id: "00000000-0000-4000-8000-0000000000f1", username: "finance", displayName: "Finance", role: "FINANCE", branch: null, permissions: FINANCE_PERMISSIONS });
