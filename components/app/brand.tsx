import Image from "next/image";
import { LOGO } from "@/lib/content";

/** The site's logo lockup (same as the landing page header). */
export function BrandMark({ name, sub = "WOLF CAR" }: { name: string; sub?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Image src={LOGO} alt="" width={40} height={40} className="size-10 object-contain" unoptimized />
      <span>
        <b className="block text-lg leading-tight font-extrabold">{name}</b>
        <small className="block text-[11px] leading-tight font-semibold tracking-[0.06em] text-muted">{sub}</small>
      </span>
    </span>
  );
}
