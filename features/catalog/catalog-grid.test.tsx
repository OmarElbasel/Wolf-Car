import { screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import type { PublicProduct } from "@/lib/api/types";
import { CatalogGrid } from "./catalog-grid";

const products: PublicProduct[] = [
  { id: "1", name: "4K Dash Cam", description: "Front and rear camera", imageUrl: "/api/uploads/a.webp", thumbUrl: "/api/uploads/a-sm.webp" },
  { id: "2", name: "3D Floor Mats", description: null, imageUrl: "/api/uploads/b.webp", thumbUrl: "/api/uploads/b-sm.webp" },
];

const renderGrid = (items: PublicProduct[]) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CatalogGrid products={items} />
    </NextIntlClientProvider>,
  );

describe("public catalog grid", () => {
  it("shows image, name and description for every product", () => {
    renderGrid(products);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "4K Dash Cam" })).toHaveAttribute("src", "/api/uploads/a-sm.webp");
    expect(screen.getByText("Front and rear camera")).toBeInTheDocument();
    expect(screen.getByText("2 products")).toBeInTheDocument();
  });

  it("filters by name or description as you type", async () => {
    renderGrid(products);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search products" }), "rear");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("4K Dash Cam")).toBeInTheDocument();
    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No products match your search.")).toBeInTheDocument();
  });

  it("has an empty state", () => {
    renderGrid([]);
    expect(screen.getByText("No products to show yet.")).toBeInTheDocument();
  });
});
