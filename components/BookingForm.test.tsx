import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { BookingForm } from "./BookingForm";

const renderForm = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BookingForm />
    </NextIntlClientProvider>,
  );

const group = (name: string) => screen.getByRole("radiogroup", { name });
const option = (groupName: string, name: string) => within(group(groupName)).getByRole("radio", { name });

afterEach(() => vi.restoreAllMocks());

describe("booking form", () => {
  it("offers every service at the Bin Omran branch", () => {
    renderForm();
    for (const name of ["Accessories", "PPF", "Tinting", "Programming", "Spare parts", "Maintenance"]) {
      expect(option("Service", name)).toBeEnabled();
    }
  });

  it("does not offer PPF with home service", async () => {
    renderForm();
    await userEvent.click(option("Service", "PPF"));
    await userEvent.click(option("Service location", "Home service"));
    expect(option("Service", "PPF")).toBeDisabled();
    expect(option("Service", "PPF")).not.toBeChecked();
    expect(option("Service", "Tinting")).toBeEnabled();
    // back at the branch it can be picked again
    await userEvent.click(option("Service location", "At the branch"));
    expect(option("Service", "PPF")).toBeEnabled();
  });

  it("offers neither PPF nor tinting at Al Gharrafa", async () => {
    renderForm();
    await userEvent.click(option("Service", "Tinting"));
    await userEvent.click(option("Branch", "Al Gharrafa"));
    expect(option("Service", "PPF")).toBeDisabled();
    expect(option("Service", "Tinting")).toBeDisabled();
    expect(option("Service", "Accessories")).toBeChecked();
  });

  it("never sends a service the chosen branch does not do", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderForm();
    await userEvent.click(option("Service", "PPF"));
    await userEvent.click(option("Branch", "Al Gharrafa"));
    await userEvent.click(screen.getByRole("button", { name: "Send via WhatsApp" }));
    const url = decodeURIComponent(String(open.mock.calls[0][0]));
    expect(url).toContain("Accessories");
    expect(url).not.toContain("PPF");
  });
});
