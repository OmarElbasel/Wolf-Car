import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Wrap } from "./Button";
import { CallButton } from "./ContactButtons";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { LOGO } from "@/lib/content";

export async function Header() {
  const t = await getTranslations("Header");
  const brand = await getTranslations("Brand");

  const LINKS = [
    { href: "#services", label: t("navServices") },
    { href: "#catalog", label: t("navCatalog") },
    { href: "#work", label: t("navWork") },
    { href: "#branches", label: t("navBranches") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface">
      <Wrap className="flex h-[66px] items-center justify-between gap-3">
        <a href="#top" aria-label={t("logoAria")} className="flex items-center gap-2.5">
          <Image src={LOGO} alt="" width={40} height={40} className="size-10 object-contain" unoptimized />
          <span>
            <b className="block text-lg leading-tight font-extrabold">{brand("name")}</b>
            <small className="block text-[11px] leading-tight font-semibold tracking-[0.06em] text-muted">
              WOLF CAR
            </small>
          </span>
        </a>

        <nav aria-label={t("navAria")} className="hidden gap-[26px] font-semibold text-ink-2 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LocaleSwitcher />
          <CallButton variant="primary" size="sm" />
        </div>
      </Wrap>
    </header>
  );
}
