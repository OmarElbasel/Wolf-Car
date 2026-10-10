import { ACCOUNTS, expect, signIn, test } from "./fixtures/test";

/**
 * On a phone no page may be wider than the screen: a page that is scrolls
 * sideways over blank space. The usual cause is a `grid` without a column
 * template, whose only column grows to fit a table, a chart or a long name
 * (fix: `grid-cols-1`).
 */
test.use({ viewport: { width: 360, height: 780 } });

const PUBLIC = ["", "/products", "/packages", "/about", "/privacy", "/terms", "/login", "/showroom/login", "/slots"];
const STAFF = [
  "/dashboard",
  "/dashboard/products",
  "/dashboard/services",
  "/dashboard/orders",
  "/dashboard/ppf-bookings",
  "/dashboard/reservations",
  "/dashboard/users",
  "/dashboard/branches",
  "/dashboard/permissions",
  "/dashboard/activity",
  "/dashboard/analytics",
  "/dashboard/analytics?range=365",
  "/dashboard/account",
];
const LONG_NAME = "Wolf Premium Nano Ceramic Paint Protection Film Full Body Package For Toyota Land Cruiser 300 GR Sport";

async function expectFits(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  // names that are cut with "…" must stay cut when they are long, not push the page wider
  await page.evaluate((long) => {
    for (const el of document.querySelectorAll("main *")) {
      const style = getComputedStyle(el);
      if (style.whiteSpace === "nowrap" && style.textOverflow === "ellipsis" && el.children.length === 0 && el.textContent?.trim()) el.textContent = long;
    }
  }, LONG_NAME);
  const { page: pageWidth, screen } = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: document.documentElement.clientWidth }));
  expect(pageWidth, `${path} is ${pageWidth}px wide on a ${screen}px screen`).toBeLessThanOrEqual(screen);
}

for (const locale of ["ar", "en"] as const) {
  test(`public pages fit a phone screen (${locale})`, async ({ page }) => {
    for (const path of PUBLIC) await expectFits(page, `/${locale}${path}`);
  });

  test(`dashboard pages fit a phone screen (${locale})`, async ({ page }) => {
    // the visitors page only draws its chart and lists once the site has been visited
    for (const type of ["pageview", "add_to_cart", "model_view", "call"] as const) {
      await page.request.post("/api/public/events", { data: { type, path: `/${locale}/products`, entry: type === "pageview", label: LONG_NAME, targetId: "p1" } });
    }
    await signIn(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password, locale);
    for (const path of STAFF) await expectFits(page, `/${locale}${path}`);
  });
}
