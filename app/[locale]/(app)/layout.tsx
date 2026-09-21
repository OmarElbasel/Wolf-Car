import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AppProviders } from "@/components/app/providers";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { loadAppMessages } from "@/lib/i18n/app-messages";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Staff dashboards, login and showroom: app messages + client providers. */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await loadAppMessages(locale);
  return (
    <NextIntlClientProvider messages={messages}>
      <AppProviders locale={locale}>
        {/* the root layout pads <body> for the landing page's mobile sticky bar; the app has none */}
        <div className="-mb-[76px] min-h-dvh bg-surface md:mb-0">{children}</div>
      </AppProviders>
    </NextIntlClientProvider>
  );
}
