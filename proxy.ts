import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

/**
 * Locale routing (next-intl) plus a fast redirect for signed-out visitors of
 * the dashboard and the showroom. The hint cookies are set by the API next to
 * the real (httpOnly, /api/auth-scoped) refresh cookies; they grant nothing —
 * the API checks every request on its own.
 */
export default function proxy(req: NextRequest) {
  const match = req.nextUrl.pathname.match(/^\/(ar|en)\/(dashboard|showroom)(\/.*)?$/);
  if (match) {
    const [, locale, area, rest = ""] = match;
    if (area === "dashboard" && !req.cookies.has("wc_session")) {
      const url = new URL(`/${locale}/login`, req.url);
      url.searchParams.set("next", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    if (area === "showroom" && !rest.startsWith("/login") && !req.cookies.has("wc_showroom")) {
      return NextResponse.redirect(new URL(`/${locale}/showroom/login`, req.url));
    }
  }
  return intl(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|assets|.*\\..*).*)"],
};
