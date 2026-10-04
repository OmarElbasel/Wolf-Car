import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, signIn, signOut, test } from "./fixtures/test";

/**
 * PPF bookings from end to end: the Super Admin creates the call-center
 * account, she sets the sales PIN and books a full PPF, a salesperson unlocks
 * the slots page, sees the day closed and asks for a light job and a second
 * full PPF (the exception), she approves
 * it, and the salesperson sees the answer.
 */
test.describe.configure({ mode: "serial" });

const PIN = "482915";
/** A day comfortably ahead in the current month view's reach: the 2nd next month, day 15. */
function targetDay(): { day: string; monthsAhead: number } {
  const qatar = new Date(Date.now() + 3 * 3_600_000);
  const d = new Date(Date.UTC(qatar.getUTCFullYear(), qatar.getUTCMonth() + 1, 15));
  return { day: d.toISOString().slice(0, 10), monthsAhead: 1 };
}
const { day: DAY, monthsAhead } = targetDay();
const cell = (page: Page, date: string) => page.locator(`button[data-date="${date}"]`);
async function goToTargetMonth(page: Page) {
  for (let i = 0; i < monthsAhead; i++) await page.getByRole("button", { name: "Next month" }).click();
  await expect(cell(page, DAY)).toBeEnabled();
}

test("admin → call center → sales → call center → sales", async ({ page, browser }) => {
  let amani = { username: "", password: "" };

  await test.step("Super Admin creates the Reservations account", async () => {
    await signIn(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password);
    await page.goto("/en/dashboard/users");
    await page.getByRole("button", { name: "Add user" }).click();
    const dialog = page.getByRole("dialog", { name: "New user" });
    await dialog.getByLabel("Full name").fill("Amani");
    await dialog.getByRole("radio", { name: /Reservations/ }).check({ force: true });
    await dialog.getByRole("button", { name: "Create" }).click();

    const credentials = page.getByRole("dialog", { name: "Save these credentials now" });
    await expect(credentials).toBeVisible();
    const secrets = await credentials.getByTestId("secret").allInnerTexts();
    amani = { username: secrets[0].trim(), password: secrets[1].trim() };
    expect(amani.username).toBe("reservations");
    await page.getByRole("button", { name: "I've saved them" }).click();
    await signOut(page);
  });

  await test.step("Amani lands on PPF bookings, sets the PIN and books a full PPF", async () => {
    await signIn(page, amani.username, amani.password);
    await page.waitForURL(/\/en\/dashboard\/ppf-bookings/);
    await expect(page.getByRole("link", { name: "General reservations" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);

    const sales = page.getByRole("region", { name: "Sales page" });
    await expect(sales.getByText(/No PIN yet/)).toBeVisible();
    await sales.getByRole("button", { name: "Set PIN" }).click();
    const pin = page.getByRole("dialog", { name: "Sales PIN" });
    await pin.getByLabel("PIN").fill(PIN);
    await pin.getByRole("button", { name: "Save" }).click();
    await expect(sales.getByText("A PIN is set.")).toBeVisible();

    await goToTargetMonth(page);
    await cell(page, DAY).click();
    await page.getByRole("button", { name: "Add booking" }).click();
    const form = page.getByRole("dialog", { name: "New booking" });
    await form.getByLabel("Car").fill("Land Cruiser 2024");
    await form.getByLabel("Owner name").fill("Khalid Al-Marri");
    await form.getByLabel(/Phone/).fill("55123456");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("article", { name: "Land Cruiser 2024" })).toBeVisible();
    await expect(cell(page, DAY)).toHaveAttribute("data-state", "FULL");

  });

  // the salesperson is a different person on a different phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", timezoneId: "Asia/Qatar" });
  const sales = await phone.newPage();

  await test.step("A salesperson unlocks the slots page and asks for a light job", async () => {
    const response = await sales.goto("/en/slots");
    // customer data lives here: the page must not be framed by another site
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    await sales.getByLabel("PIN").fill("000000");
    await sales.getByRole("button", { name: "Open" }).click();
    await expect(sales.getByText("Wrong PIN.")).toBeVisible();
    await sales.getByLabel("PIN").fill(PIN);
    await sales.getByRole("button", { name: "Open" }).click();

    await goToTargetMonth(sales);
    await expect(cell(sales, DAY)).toHaveAttribute("data-state", "FULL");
    await cell(sales, DAY).click();
    await expect(sales.getByText("Closed: a full PPF car is booked.")).toBeVisible();
    await sales.getByRole("button", { name: "Request a light job" }).click();
    const request = sales.getByRole("dialog", { name: "Request a light job" });
    await request.getByLabel("Your name").fill("Yousef");
    await request.getByLabel("Car").fill("Lexus LX");
    await request.getByLabel("Owner name").fill("Sara Al-Kuwari");
    await request.getByLabel("What is the job?").fill("Front windows tint");
    await request.getByRole("button", { name: "Send request" }).click();
    await expect(request).toHaveCount(0);

    // and for a second full PPF, as an exception: it waits for the call center, the day is not taken
    await sales.getByRole("button", { name: "Request a second full PPF (exception)" }).click();
    const second = sales.getByRole("dialog", { name: "Request a full PPF" });
    await expect(second.getByLabel("Your name")).toHaveValue("Yousef");
    await second.getByLabel("Car").fill("Nissan Patrol");
    await second.getByLabel("Owner name").fill("Hamad Al-Thani");
    await second.getByRole("button", { name: "Send request" }).click();
    await expect(second).toHaveCount(0);
    await expect(sales.getByRole("list", { name: "Waiting for the call center" }).getByText("Nissan Patrol")).toBeVisible();

    await sales.getByRole("button", { name: "Show booked cars" }).click();
    const panel = sales.getByRole("dialog", { name: "Booked cars" });
    await expect(panel.getByRole("article", { name: "Land Cruiser 2024" }).getByRole("link", { name: "55123456" })).toBeVisible();
    await expect(panel.getByRole("article", { name: "Lexus LX" }).getByText("Waiting")).toBeVisible();
    await expect(panel.getByRole("article", { name: "Nissan Patrol" }).getByText("Full PPF")).toBeVisible();

    // the phone is remembered: a reload does not ask for the PIN again
    await sales.reload();
    await expect(sales.getByLabel("PIN")).toHaveCount(0);
    await expect(sales.getByRole("button", { name: "Next month" })).toBeVisible();
  });

  await test.step("Amani sees the requests waiting and approves them", async () => {
    await page.reload();
    await expect(page.getByRole("link", { name: /PPF bookings/ })).toContainText("2");
    await page.getByRole("tab", { name: /Requests/ }).click();
    const card = page.getByRole("article", { name: "Lexus LX" });
    await expect(card.getByText("Front windows tint")).toBeVisible();
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(card.getByText("Approved")).toBeVisible();
    const exception = page.getByRole("article", { name: "Nissan Patrol" });
    await expect(exception.getByText("Full PPF")).toBeVisible();
    await exception.getByRole("button", { name: "Approve" }).click();
    await expect(exception.getByText("Approved")).toBeVisible();

    await page.getByRole("tab", { name: "Calendar" }).click();
    await goToTargetMonth(page);
    await cell(page, DAY).click();
    const light = page.getByRole("article", { name: "Lexus LX" });
    await expect(light.getByText("Light job")).toBeVisible();
    await expect(light.getByText(/Requested by .*Yousef/)).toBeVisible();
    await expect(page.getByRole("article", { name: "Nissan Patrol" }).getByText("Full PPF")).toBeVisible();

    // two full PPF cars is the limit: a third is refused
    await page.getByRole("button", { name: "Add booking" }).click();
    const form = page.getByRole("dialog", { name: "New booking" });
    await form.getByLabel("Car").fill("Tahoe");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByRole("alert")).toHaveText("This day already has two full PPF cars.");
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(cell(page, DAY)).toHaveAttribute("data-state", "FULL");
  });

  await test.step("The salesperson sees the answer and the light job", async () => {
    await sales.reload();
    await sales.getByRole("button", { name: "Show booked cars" }).click();
    const panel = sales.getByRole("dialog", { name: "Booked cars" });
    await expect(panel.getByRole("article", { name: "Lexus LX" }).getByText("Approved")).toBeVisible();
    await expect(panel.getByRole("article", { name: "Lexus LX" }).getByText("Light job").first()).toBeVisible();
    await sales.keyboard.press("Escape");
    await goToTargetMonth(sales);
    await cell(sales, DAY).click();
    await expect(sales.getByText("Closed: two full PPF cars are booked. Light jobs only.")).toBeVisible();
    await expect(sales.getByRole("button", { name: /full PPF/ })).toHaveCount(0);
  });

  await test.step("A general reservation stays out of the sales page", async () => {
    await page.goto("/en/dashboard/reservations");
    await page.getByRole("button", { name: "Add reservation" }).click();
    const form = page.getByRole("dialog", { name: "New reservation" });
    await form.getByLabel("Service").fill("Ceramic coating for Hidden Customer");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("article", { name: "Ceramic coating for Hidden Customer" })).toBeVisible();

    await sales.reload();
    await sales.getByRole("button", { name: "Show booked cars" }).click();
    await expect(sales.getByText(/Hidden Customer/)).toHaveCount(0);
  });

  await test.step("Changing the PIN signs the phone out", async () => {
    await page.goto("/en/dashboard/ppf-bookings");
    const card = page.getByRole("region", { name: "Sales page" });
    await card.getByRole("button", { name: "Change PIN" }).click();
    const pin = page.getByRole("dialog", { name: "Sales PIN" });
    await pin.getByLabel("PIN").fill("135790");
    await pin.getByRole("button", { name: "Save" }).click();
    await expect(pin).toHaveCount(0);

    await sales.reload();
    await expect(sales.getByLabel("PIN")).toBeVisible();
    await expect(sales.getByText(/Khalid/)).toHaveCount(0);
  });

  await phone.close();
});
