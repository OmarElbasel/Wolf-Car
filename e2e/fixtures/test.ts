import { expect, test as base, type Page } from "@playwright/test";

/** Console messages that are expected and harmless. */
const IGNORED = [
  /Failed to load resource: the server responded with a status of (401|403|404|409|423)/, // asserted API failures
];

/**
 * `test` with a console/page-error trap: any unexpected console error or
 * uncaught exception fails the test.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && !IGNORED.some((re) => re.test(msg.text()))) errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      await use(errors);
      expect(errors, "unexpected browser console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const ACCOUNTS = {
  admin: { username: "admin", password: "SuperWolf#2026!" },
  finance: { username: "finance", password: "Ledger#Wolf2026!" },
  ghManager: { username: "gh.manager", password: "Manager#Wolf2026!" },
  ghCashier: { username: "gh.cashier", password: "Cashier#Wolf2026!" },
  boCashier: { username: "bo.cashier", password: "Cashier#Wolf2026!" },
  showroom: "Showroom#2026!",
} as const;

export async function signIn(page: Page, username: string, password: string, locale: "en" | "ar" = "en") {
  await page.goto(`/${locale}/login`);
  await page.getByLabel(locale === "ar" ? "اسم المستخدم" : "Username").fill(username);
  await page.getByLabel(locale === "ar" ? "كلمة المرور" : "Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: locale === "ar" ? "تسجيل الدخول" : "Sign in" }).click();
  await page.waitForURL(new RegExp(`/${locale}/dashboard`));
}

export async function signOut(page: Page) {
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: /Sign out|تسجيل الخروج/ }).click();
  await page.waitForURL(/\/login/);
}
