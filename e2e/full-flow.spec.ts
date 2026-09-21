import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, signIn, signOut, test } from "./fixtures/test";

/**
 * The whole business flow in one browser session, as each role would do it:
 * the Super Admin opens a branch, its manager adds and orders a product,
 * Finance prices it, the showroom tablet places an order, the cashier confirms
 * it and downloads the receipt, and the Super Admin finds every step in the
 * activity log.
 */
test.describe.configure({ mode: "serial" });

const BRANCH = { code: "WK", name: "Al Wakra Branch", nameAr: "فرع الوكرة" };
const MANAGER = "Wakra Manager";
const CASHIER = "Wakra Cashier";
const PRODUCT = { name: "Ceramic Coating Kit", description: "Nine-month gloss protection", barcode: "WK-CERAMIC-9" };
const PRICE = "349.50";
const CUSTOMER = "Mariam Al-Kuwari";

interface Issued {
  username: string;
  password: string;
  showroomPassword: string;
}

/** Reads one account from the one-time credentials dialog. */
async function readCredentials(page: Page, displayName: string): Promise<Issued> {
  const section = page.getByRole("dialog").getByRole("region", { name: displayName });
  const secrets = section.getByTestId("secret");
  await expect(secrets).toHaveCount(3);
  const [username, password, showroomPassword] = await secrets.allInnerTexts();
  return { username: username.trim(), password: password.trim(), showroomPassword: showroomPassword.trim() };
}

test("admin → manager → finance → showroom → cashier → activity log", async ({ page }) => {
  let manager: Issued;
  let cashier: Issued;
  let orderCode = "";

  await test.step("Super Admin creates a branch with its manager and cashier", async () => {
    await signIn(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password);
    await page.goto("/en/dashboard/branches");
    await page.getByRole("button", { name: "Add branch" }).click();
    const sheet = page.getByRole("dialog", { name: "New branch" });
    await sheet.getByLabel("Code").fill(BRANCH.code);
    await sheet.getByLabel("Name (English)").fill(BRANCH.name);
    await sheet.getByLabel("Name (Arabic)").fill(BRANCH.nameAr);
    await sheet.getByRole("group", { name: "Branch manager" }).getByLabel("Full name").fill(MANAGER);
    await sheet.getByRole("group", { name: "Cashier" }).getByLabel("Full name").fill(CASHIER);
    await sheet.getByRole("button", { name: "Create" }).click();

    await expect(page.getByRole("dialog", { name: "Save these credentials now" })).toBeVisible();
    manager = await readCredentials(page, MANAGER);
    cashier = await readCredentials(page, CASHIER);
    expect(manager.username).toMatch(/^wk\./);
    expect(cashier.username).toMatch(/^wk\./);
    await page.getByRole("button", { name: "I've saved them" }).click();
    await expect(page.getByRole("dialog", { name: "Save these credentials now" })).toHaveCount(0);
    await expect(page.getByRole("main")).toContainText(BRANCH.name);
    await signOut(page);
  });

  await test.step("the new manager adds a product (no price field) and reorders the showroom", async () => {
    await signIn(page, manager.username, manager.password);
    await expect(page).toHaveURL(/\/en\/dashboard\/products$/);
    await page.getByRole("button", { name: "Add product" }).first().click();
    const sheet = page.getByRole("dialog", { name: "New product" });
    await expect(sheet.getByLabel(/price/i)).toHaveCount(0);
    await sheet.getByLabel("Name").fill(PRODUCT.name);
    await sheet.getByLabel("Description").fill(PRODUCT.description);
    await sheet.getByLabel("Barcode").fill(PRODUCT.barcode);
    await sheet.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "product.png"));
    await sheet.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByText("Product created")).toBeVisible();

    const row = page.getByRole("listitem").filter({ hasText: PRODUCT.name });
    await expect(row).toContainText("Awaiting price");
    // keyboard reorder: pick up, move one place up, drop — each step waits for
    // dnd-kit's screen-reader announcement, as a keyboard user would hear it
    const handle = page.getByRole("button", { name: `Reorder ${PRODUCT.name}` });
    const announcer = page.getByRole("status").filter({ hasText: PRODUCT.name });
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(announcer).toContainText("moved to position 14 of 14");
    await page.keyboard.press("ArrowUp");
    await expect(announcer).toContainText("moved to position 13 of 14");
    await page.keyboard.press("Space");
    await expect(announcer).toContainText("dropped at position 13 of 14");
    await expect(page.getByText("Showroom order saved")).toBeVisible();
    await signOut(page);
  });

  await test.step("Finance sets the price", async () => {
    await signIn(page, ACCOUNTS.finance.username, ACCOUNTS.finance.password);
    await page.getByPlaceholder("Search by name or barcode").fill(PRODUCT.name);
    const row = page.getByRole("listitem").filter({ hasText: PRODUCT.name });
    await expect(page.getByRole("listitem").filter({ hasText: "Awaiting price" })).toHaveCount(1);
    await row.getByRole("button", { name: "Set price" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Price (QAR)").fill(PRICE);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Price saved")).toBeVisible();
    await expect(row).toContainText("349.50");
    await signOut(page);
  });

  await test.step("the showroom tablet places an order with the manager's showroom password", async () => {
    await page.goto("/en/showroom/login");
    await page.getByLabel("Username").fill(manager.username);
    await page.getByLabel("Showroom password").fill(manager.showroomPassword);
    await page.getByRole("button", { name: "Open the showroom" }).click();
    await expect(page).toHaveURL(/\/en\/showroom$/);
    await expect(page.getByTestId("branch-name")).toHaveText(BRANCH.name);

    await page.getByRole("button", { name: `Add ${PRODUCT.name}` }).click();
    await page.getByRole("button", { name: `Add ${PRODUCT.name}` }).click();
    const cart = page.getByTestId("cart-panel").first();
    await expect(cart.getByTestId("line-quantity")).toHaveText("2");
    await expect(cart.getByTestId("cart-total")).toContainText("699.00");

    await cart.getByRole("button", { name: "Place order" }).click();
    const dialog = page.getByRole("dialog", { name: "Almost done" });
    await dialog.getByLabel("Customer name").fill(CUSTOMER);
    await dialog.getByRole("button", { name: "Submit order" }).click();
    await expect(page.getByText("Order placed")).toBeVisible();
    orderCode = (await page.getByTestId("order-code").innerText()).trim();
    expect(orderCode).toBe("WK-000001");
    await page.getByRole("button", { name: "Next customer" }).click();
    await expect(cart.getByText("Your cart is empty")).toBeVisible();
  });

  await test.step("the cashier confirms the order and downloads the receipt", async () => {
    await signIn(page, cashier.username, cashier.password);
    await expect(page).toHaveURL(/\/en\/dashboard\/orders$/);
    await page.getByRole("button", { name: `Open order ${orderCode}` }).click();
    // codes are wrapped in Unicode directional isolates inside translated text
    const sheet = page.getByRole("dialog", { name: new RegExp(`^Order \\W?${orderCode}\\W?$`) });
    await expect(sheet).toContainText(CUSTOMER);
    await expect(sheet).toContainText(PRODUCT.name);
    await sheet.getByRole("button", { name: "Confirm order" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm order" }).click();
    await expect(page.getByText(new RegExp(`Order \\W?${orderCode}\\W? confirmed`))).toBeVisible();

    const download = page.waitForEvent("download");
    await sheet.getByRole("button", { name: "English receipt" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(`receipt-${orderCode}.pdf`);
    const pdf = await readFile(await file.path());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await signOut(page);
  });

  await test.step("the Super Admin sees every step in the activity log", async () => {
    await signIn(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password);
    const steps: [action: string, label: string, actor: string][] = [
      ["branch.create", "Branch created", "admin"],
      ["product.create", "Product created", manager.username],
      ["product.reorder", "Showroom reordered", manager.username],
      ["product.price.update", "Price changed", "finance"],
      ["order.create", "Order placed", manager.username],
      ["order.confirm", "Order confirmed", cashier.username],
      ["order.receipt.download", "Receipt downloaded", cashier.username],
    ];
    for (const [action, label, actor] of steps) {
      await page.goto(`/en/dashboard/activity?action=${action}&actor=${actor}`);
      const entry = page.getByRole("row").filter({ hasText: label }).filter({ hasText: actor });
      await expect(entry.first(), `${action} by ${actor}`).toBeVisible();
    }
  });
});
