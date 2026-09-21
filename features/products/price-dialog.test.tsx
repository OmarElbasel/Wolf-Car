import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/tests/msw";
import { renderWithApp } from "@/tests/render";
import { finance, makeProduct } from "./fixtures";
import { normalizePrice, PriceDialog } from "./price-dialog";

describe("price dialog", () => {
  const product = makeProduct({ name: "Oil filter", price: null });

  it("shows the Validation message for an invalid price and sends nothing", async () => {
    const patch = vi.fn();
    server.use(http.patch("/api/products/:id/price", () => patch()));
    const { user } = renderWithApp(<PriceDialog open product={product} onOpenChange={vi.fn()} />, { user: finance() });
    expect(screen.getByRole("dialog", { name: "Price for \u2068Oil filter\u2069" })).toBeInTheDocument();
    expect(screen.getByText("Not set yet")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Price (QAR)"), "12.345");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter an amount with up to 2 decimals, e.g. 125 or 125.50.")).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it("PATCHes only { price } and closes on success", async () => {
    let body: unknown = null;
    server.use(
      http.patch("/api/products/:id/price", async ({ request, params }) => {
        body = await request.json();
        return HttpResponse.json({ ...product, id: params.id, price: "125.50" });
      }),
    );
    const success = vi.spyOn(toast, "success");
    const onOpenChange = vi.fn();
    const { user } = renderWithApp(<PriceDialog open product={product} onOpenChange={onOpenChange} />, { user: finance() });

    await user.type(screen.getByLabelText("Price (QAR)"), "125.50");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(body).toEqual({ price: "125.50" });
    expect(success).toHaveBeenCalledWith("Price saved");
  });

  it("accepts Arabic-Indic digits typed on an Arabic keyboard", () => {
    expect(normalizePrice(" \u0661\u0662\u0665\u066B\u0665\u0660 ")).toBe("125.50");
  });
});
