import Image from "next/image";
import { getLocale } from "next-intl/server";
import { getCarBrands, type CarBrand } from "@/lib/content";

/**
 * Four copies of the list, animated by exactly one copy's width (-25%).
 * Two copies leaves an empty gap once the track has travelled past the
 * viewport — that reads as the strip "waiting" before it restarts.
 */
const COPIES = 4;

function BrandList({ hidden, brands, dir }: { hidden: boolean; brands: CarBrand[]; dir: "rtl" | "ltr" }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className="m-0 flex list-none items-center gap-11 px-[22px] md:gap-16 md:px-8"
    >
      {brands.map((b) => (
        <li key={b.name} className="flex flex-none items-center gap-2.5 opacity-60">
          {b.logo && (
            <Image
              src={b.logo}
              alt=""
              width={120}
              height={120}
              unoptimized
              /* next/image lazy-loads by default; the track moves by transform,
                 not scroll, so lazy copies can stay blank as they rotate in */
              loading="eager"
              className="h-8 w-auto object-contain md:h-[38px]"
            />
          )}
          <span
            dir={dir}
            className={
              b.wordmark
                ? "text-base font-bold whitespace-nowrap text-[#E4E4E4]"
                : "text-sm font-semibold whitespace-nowrap text-[#C8C8C8]"
            }
          >
            {b.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

export async function BrandStrip() {
  const locale = await getLocale();
  const brands = getCarBrands(locale);
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div className="overflow-hidden bg-strip py-5 text-white">
      <div className="marquee-mask overflow-hidden" dir="ltr">
        <div className="marquee-track flex">
          {Array.from({ length: COPIES }, (_, i) => (
            <BrandList key={i} hidden={i > 0} brands={brands} dir={dir} />
          ))}
        </div>
      </div>
    </div>
  );
}
