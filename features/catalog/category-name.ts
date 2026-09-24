import type { PublicCategory } from "@/lib/api/types";

/** The name to show for a car model: its English name on /en when it has one, else the Arabic. */
export function categoryName(category: Pick<PublicCategory, "name" | "nameEn">, locale: string): string {
  return locale === "en" ? (category.nameEn ?? category.name) : category.name;
}
