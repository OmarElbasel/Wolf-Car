import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { THEME_SCRIPT } from "@/lib/theme";
import { routing } from "@/i18n/routing";
import "../globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolved: Locale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolved, namespace: "Meta" });
  return {
    title: t("title"),
    description: t("description"),
    icons: {
      icon: "https://res.cloudinary.com/dzcq09k8h/image/upload/v1777807970/Logo-removebg-preview_mg3e4j.png",
    },
  };
}

const OPENING = [
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
    opens: "10:00",
    closes: "23:00",
  },
  { "@type": "OpeningHoursSpecification", dayOfWeek: "Friday", opens: "16:00", closes: "23:00" },
];

const SCHEMA = [
  {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: "Wolf Car — Al Gharrafa",
    alternateName: "وولف كار — الغرافة",
    telephone: "+97471007113",
    email: "info@wolfcar.qa",
    url: "https://wolfcar.qa/",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Souq Al Gharrafa",
      addressLocality: "Al Rayyan",
      addressCountry: "QA",
    },
    openingHoursSpecification: OPENING,
  },
  {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: "Wolf Car Service — Bin Omran",
    alternateName: "كيو وولف كار لخدمات السيارات — بن عمران",
    telephone: "+97471008939",
    email: "info@wolfcar.qa",
    url: "https://wolfcar.qa/",
    address: { "@type": "PostalAddress", addressLocality: "Bin Omran, Doha", addressCountry: "QA" },
    openingHoursSpecification: OPENING,
  },
];

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={cairo.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="font-sans pb-[76px] md:pb-0">
        {/* First in <body> so it runs before anything paints, which is what
            keeps the theme from flashing. React dev-warns about executable
            inline scripts ("Encountered a script tag...") and there is no way
            around it — next/script beforeInteractive emits the same thing. The
            warning is dev-only; the script ships in the HTML and does run. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
        />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
