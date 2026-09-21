import { ACCOUNTS, expect, signIn, test } from "./fixtures/test";

test.describe("sign-in and role landing pages", () => {
  test("signed-out visitors are sent to the login page", async ({ page }) => {
    await page.goto("/en/dashboard/orders");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fdashboard%2Forders/);
    await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
  });

  const landing = [
    ["admin", ACCOUNTS.admin, /\/en\/dashboard$/],
    ["finance", ACCOUNTS.finance, /\/en\/dashboard\/products$/],
    ["branch manager", ACCOUNTS.ghManager, /\/en\/dashboard\/products$/],
    ["cashier", ACCOUNTS.ghCashier, /\/en\/dashboard\/orders$/],
  ] as const;
  for (const [role, account, url] of landing) {
    test(`${role} lands on their dashboard`, async ({ page }) => {
      await signIn(page, account.username, account.password);
      await expect(page).toHaveURL(url);
    });
  }

  test("wrong password shows a clear inline error", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText("Wrong username or password.");
  });

  test("the navigation only offers what the role may use", async ({ page }) => {
    await signIn(page, ACCOUNTS.ghCashier.username, ACCOUNTS.ghCashier.password);
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Products" })).toHaveCount(0);
  });

  test("Arabic dashboard renders right-to-left", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("مرحبًا");
  });
});

test.describe("public catalog", () => {
  test("is linked from the landing page footer and never shows prices or barcodes", async ({ page, request }) => {
    await page.goto("/en");
    const footerLinks = page.locator("footer nav");
    await expect(footerLinks.getByRole("link", { name: "Product catalog" })).toHaveAttribute("href", "/en/products");
    await expect(footerLinks.getByRole("link", { name: "Staff login" })).toHaveAttribute("href", "/en/login");

    await footerLinks.getByRole("link", { name: "Product catalog" }).click();
    await expect(page).toHaveURL(/\/en\/products$/);
    const cards = page.getByTestId("catalog-grid").getByRole("listitem");
    await expect(cards).toHaveCount(13);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/QAR|499|1,800|6291041500213/);

    const api = await request.get("/api/public/products");
    const body = await api.text();
    expect(body).not.toMatch(/"price"|"barcode"/);
    for (const product of JSON.parse(body) as Record<string, unknown>[]) {
      expect(Object.keys(product).sort()).toEqual(["description", "id", "imageUrl", "name", "thumbUrl"]);
    }
  });

  test("is available in Arabic", async ({ page }) => {
    await page.goto("/ar/products");
    await expect(page.getByRole("heading", { name: "كتالوج المنتجات" })).toBeVisible();
  });
});
