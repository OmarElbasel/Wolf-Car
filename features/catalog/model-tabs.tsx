import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { PublicCategory } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { categoryName } from "./category-name";

/**
 * Car-model navigation for the public catalogue: horizontal chips on phones
 * and tablets, a "shop by car" sidebar from lg up. Plain links
 * (?category=<id>), so a model's page can be shared and the landing page's
 * cards can deep-link straight into it.
 */
interface Props {
  categories: PublicCategory[];
  /** the selected category id; undefined shows every product */
  selected: string | undefined;
}

const href = (id: string | undefined) => (id ? { pathname: "/products" as const, query: { category: id } } : "/products");

export async function ModelTabs({ categories, selected }: Props) {
  const t = await getTranslations("ProductsPage");
  const locale = await getLocale();
  if (categories.length === 0) return null;

  const total = categories.reduce((sum, c) => sum + c.count, 0);
  const tabs = [{ id: undefined, name: t("allModels"), count: total }, ...categories.map((c) => ({ ...c, name: categoryName(c, locale) }))];

  return (
    <nav aria-label={t("models")} className="-mx-5 mb-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:thin] lg:hidden">
      {tabs.map((c) => {
        const active = c.id === selected;
        return (
          <Link
            key={c.id ?? "all"}
            href={href(c.id)}
            aria-current={active ? "page" : undefined}
            dir="auto"
            className={cn(
              "flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2.5 text-[15px] font-bold whitespace-nowrap transition-colors",
              active ? "border-accent bg-accent text-white" : "border-line bg-surface hover:border-accent",
            )}
          >
            {c.name}
            <span
              className={cn(
                "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs tabular-nums",
                active ? "bg-white/25 text-white" : "bg-sand text-ink-2",
              )}
              aria-hidden="true"
            >
              {c.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export async function ModelSidebar({ categories, selected }: Props) {
  const t = await getTranslations("ProductsPage");
  const locale = await getLocale();
  if (categories.length === 0) return null;
  const total = categories.reduce((sum, c) => sum + c.count, 0);

  const row = (active: boolean) =>
    cn(
      "flex min-h-[52px] items-center gap-3 border-s-[3px] px-3 py-1.5 text-[15px] font-bold transition-colors",
      active ? "border-accent bg-sand text-ink" : "border-transparent text-ink-2 hover:bg-sand hover:text-ink",
    );

  return (
    <nav
      aria-label={t("models")}
      className="sticky top-[86px] hidden max-h-[calc(100dvh-106px)] self-start overflow-hidden rounded-[var(--radius-brand-lg)] border border-line bg-surface lg:flex lg:flex-col"
    >
      <p className="bg-charcoal px-4 py-3.5 text-[15px] font-extrabold text-white">{t("shopByCar")}</p>
      <ul className="overflow-y-auto py-1.5 [scrollbar-width:thin]">
        <li>
          <Link href={href(undefined)} aria-current={selected === undefined ? "page" : undefined} className={row(selected === undefined)}>
            <span className="grid h-9 w-14 shrink-0 place-items-center rounded-md bg-accent text-xs font-extrabold text-white">
              {t("allShort")}
            </span>
            <span className="flex-1">{t("allModels")}</span>
            <Count n={total} />
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={href(c.id)} aria-current={c.id === selected ? "page" : undefined} className={row(c.id === selected)}>
              <span className="relative h-9 w-14 shrink-0">
                {c.thumbUrl && <Image src={c.thumbUrl} alt="" fill sizes="56px" className="object-contain" unoptimized />}
              </span>
              <span dir="auto" className="flex-1 text-start leading-snug">
                {categoryName(c, locale)}
              </span>
              <Count n={c.count} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="grid h-6 min-w-7 place-items-center rounded-full bg-sand px-1.5 text-xs text-ink-2 tabular-nums" aria-hidden="true">
      {n}
    </span>
  );
}
