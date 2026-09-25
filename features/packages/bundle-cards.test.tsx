import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { cart, useCart } from "@/features/catalog/cart";
import en from "@/messages/en.json";
import { BundleCards } from "./bundle-cards";

const renderCards = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BundleCards />
    </NextIntlClientProvider>,
  );

const card = (name: string) => screen.getByRole("heading", { name }).closest("li")!;

afterEach(() => act(() => cart.clear()));

describe("complete protection packages", () => {
  it("shows each package's film, whole-number price and coupon", () => {
    renderCards();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    const second = card("Package 2");
    expect(second).toHaveTextContent("German film");
    expect(second).toHaveTextContent("QAR 6,999");
    expect(second).not.toHaveTextContent("6,999.00");
    expect(second).toHaveTextContent("+ QAR 1,000 purchase coupon");
  });

  it("adds a package to the basket with its film in the name", async () => {
    renderCards();
    const { result } = renderHook(() => useCart());
    await userEvent.click(within(card("Package 2")).getByRole("button", { name: "Add to order" }));
    expect(result.current).toEqual([
      {
        id: "pkg:bundle2",
        name: "Package 2 · complete protection · German film",
        price: "6999.00",
        thumbUrl: "/assets/packages/de.svg",
        qty: 1,
      },
    ]);
    // the button becomes the same quantity stepper as the parts catalogue
    expect(within(card("Package 2")).getByRole("group", { name: "Quantity of Package 2 · complete protection · German film" })).toHaveTextContent("1");
  });

  it("shows each package's poster, and opens it full size", async () => {
    renderCards();
    await userEvent.click(within(card("Package 3")).getByRole("button", { name: "View the Package 3 poster full size" }));
    const dialog = await screen.findByRole("dialog", { name: "Package 3" });
    expect(within(dialog).getByRole("img", { name: "Package 3" })).toHaveAttribute("src", expect.stringContaining("bundle3.webp"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
