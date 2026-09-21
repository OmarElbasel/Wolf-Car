import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // all dates in the app are shown in Qatar time
    timeZone: "Asia/Qatar",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
