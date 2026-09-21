import Image from "next/image";
import { LOGO } from "@/lib/content";

/** The site's logo lockup (same as the landing page header). */
export function BrandMark({ name, sub = "WOLF CAR" }: { name: string; sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Image src={LOGO} alt="" width={40} height={40} className="size-10 shrink-0 object-contain" unoptimized />
      <span className="min-w-0">
        <b className="block text-lg leading-tight font-extrabold whitespace-nowrap">{name}</b>
        <small className="block truncate text-[11px] leading-tight font-semibold tracking-[0.06em] text-muted">{sub}</small>
      </span>
    </span>
  );
}
