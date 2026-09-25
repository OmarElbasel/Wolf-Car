import { act, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { cart, useCart } from "@/features/catalog/cart";
import en from "@/messages/en.json";
import { FrontProtection } from "./front-protection";

const renderFront = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <FrontProtection />
    </NextIntlClientProvider>,
  );

const film = (name: string) => screen.getByRole("heading", { name }).closest("li")!;

afterEach(() => act(() => cart.clear()));

describe("front protection", () => {
  it("shows sedan prices first and switches every film to SUV prices", async () => {
    renderFront();
    const cheapest = film("German film · Standard");
    expect(screen.getByRole("button", { name: "Sedan" })).toHaveAttribute("aria-pressed", "true");
    expect(cheapest).toHaveTextContent(/Quarter front\s*QAR 1,500/);
    expect(cheapest).toHaveTextContent(/Full front\s*QAR 1,700/);

    await userEvent.click(screen.getByRole("button", { name: "SUV / 4×4" }));
    expect(screen.getByRole("button", { name: "SUV / 4×4" })).toHaveAttribute("aria-pressed", "true");
    expect(cheapest).toHaveTextContent(/Quarter front\s*QAR 1,700/);
    expect(cheapest).toHaveTextContent(/Full front\s*QAR 2,000/);
    expect(film("American film")).toHaveTextContent(/Full front\s*QAR 4,000/);
  });

  it("shows the quarter-front and full-front posters, each opening full size", async () => {
    renderFront();
    expect(screen.getByRole("button", { name: "View the Quarter front protection poster full size" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View the Full front protection poster full size" }));
    const dialog = await screen.findByRole("dialog", { name: "Full front protection" });
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", expect.stringContaining("front-full.webp"));
  });

  it("adds the chosen coverage, film and car type to the basket", async () => {
    renderFront();
    const { result } = renderHook(() => useCart());
    await userEvent.click(screen.getByRole("button", { name: "SUV / 4×4" }));
    const name = "Full front protection · German film · Premium · SUV / 4×4";
    await userEvent.click(within(film("German film · Premium")).getByRole("button", { name: `Add ${name} to your order` }));
    expect(result.current).toEqual([{ id: "pkg:front:dePremium:full:suv", name, price: "3500.00", thumbUrl: "/assets/packages/de.svg", qty: 1 }]);
    expect(screen.getByRole("group", { name: `Quantity of ${name}` })).toHaveTextContent("1");

    // the sedan option is a different line, so it can still be added
    await userEvent.click(screen.getByRole("button", { name: "Sedan" }));
    expect(screen.queryByRole("group", { name: `Quantity of ${name}` })).not.toBeInTheDocument();
    expect(
      within(film("German film · Premium")).getByRole("button", { name: "Add Full front protection · German film · Premium · Sedan to your order" }),
    ).toBeInTheDocument();
  });
});
