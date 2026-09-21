import { connection } from "next/server";
import type { PublicProduct } from "@/lib/api/types";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/**
 * Server-side fetch of the public catalogue (image, name, description only —
 * the API never sends price or barcode here). Cached for 60 s; returns null
 * when the API is unreachable so the page can say so instead of crashing.
 * Rendered per request (connection()), so a build never bakes in whatever the
 * build machine's API returned, or an "unavailable" page when it had none.
 */
export async function fetchPublicCatalog(): Promise<PublicProduct[] | null> {
  await connection();
  try {
    const res = await fetch(`${API_INTERNAL_URL}/api/public/products`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as PublicProduct[];
  } catch {
    return null;
  }
}
