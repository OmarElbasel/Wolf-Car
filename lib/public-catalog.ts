import { connection } from "next/server";
import type { PublicCategory, PublicProduct } from "@/lib/api/types";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/**
 * Server-side fetches of the public catalogue (image, name, description and
 * category only — the API never sends price or barcode here). Cached for 60 s;
 * they return null when the API is unreachable so the page can say so instead
 * of crashing. Rendered per request (connection()), so a build never bakes in
 * whatever the build machine's API returned, or an "unavailable" page when it had none.
 */
async function fetchPublic<T>(path: string): Promise<T | null> {
  await connection();
  try {
    const res = await fetch(`${API_INTERNAL_URL}/api/public/${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function fetchPublicCatalog(categoryId?: string): Promise<PublicProduct[] | null> {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  return fetchPublic<PublicProduct[]>(`products${query}`);
}

export function fetchPublicCategories(): Promise<PublicCategory[] | null> {
  return fetchPublic<PublicCategory[]>("categories");
}
