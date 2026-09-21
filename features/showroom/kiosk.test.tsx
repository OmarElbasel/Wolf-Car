import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { setAccessToken } from "@/lib/api/client";
import type { OrderDetail, ShowroomProduct } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { router } from "@/tests/setup";
import { ShowroomKiosk, type ShowroomCatalog } from "./kiosk";
import { SUCCESS_RESET_MS } from "./success-overlay";
import { IDLE_TIMEOUT_MS } from "./use-idle-timeout";

const staff = makeUser({ permissions: ["order.create"] });

const BRAKES: ShowroomProduct = {
  id: "7c1f1f7e-0000-4000-8000-000000000001",
  name: "Brake pads",
  description: "Ceramic front pads",
  barcode: "BP-100",
  price: "145.50",
  imageUrl: "/api/uploads/brakes.webp",
  thumbUrl: "/api/uploads/brakes-sm.webp",
};
const CLIP: ShowroomProduct = {
  id: "7c1f1f7e-0000-4000-8000-000000000002",
  name: "Trim clip",
  description: null,
  barcode: null,
  price: "0.10",
  imageUrl: "/api/uploads/clip.webp",
  thumbUrl: "/api/uploads/clip-sm.webp",
};
const catalog = (products: ShowroomProduct[] = [BRAKES, CLIP]): ShowroomCatalog => ({
  branch: { id: "b-gh", code: "GH", name: "Al Gharrafa Branch", nameAr: "فرع الغرافة" },
  products,
});

function orderFor(customerName: string): OrderDetail {
  return {
    id: "o-1",
    code: "GH-000042",
    number: 42,
    status: "PENDING",
    customerName,
    total: "436.60",
    currency: "QAR",
    itemCount: 4,
    branch: catalog().branch,
    createdBy: { id: staff.id, username: staff.username, displayName: staff.displayName },
    confirmedBy: null,
    confirmedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    createdAt: "2026-09-21T10:00:00.000Z",
    updatedAt: "2026-09-21T10:00:00.000Z",
    items: [],
  };
}

function renderKiosk() {
  return renderWithApp(
    <>
      <ShowroomKiosk />
      <Toaster />
    </>,
    { user: staff },
  );
}

const panel = () => screen.getByTestId("cart-panel");

beforeEach(() => {
  sessionStorage.clear();
  // two sessions in memory: showroom calls must use the showroom one
  setAccessToken("dashboard", "dashboard-token");
  setAccessToken("showroom", "showroom-token");
});

afterEach(() => {
  setAccessToken("dashboard", null);
  setAccessToken("showroom", null);
  vi.useRealTimers();
});

describe("showroom kiosk", () => {
  it("lists the branch's products using the showroom session", async () => {
    const auth: (string | null)[] = [];
    server.use(
      http.get("/api/showroom/products", ({ request }) => {
        auth.push(request.headers.get("authorization"));
        return HttpResponse.json(catalog());
      }),
    );
    renderKiosk();

    expect(await screen.findByRole("heading", { name: "Brake pads" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trim clip" })).toBeInTheDocument();
    expect(screen.getByText("Ceramic front pads")).toBeInTheDocument();
    expect(screen.getByText("BP-100")).toHaveAttribute("dir", "ltr");
    expect(screen.getByTestId("branch-name")).toHaveTextContent("Al Gharrafa Branch");
    expect(auth[0]).toBe("Bearer showroom-token");
    expect(within(panel()).getByText("Your cart is empty")).toBeInTheDocument();
    expect(within(panel()).getByRole("button", { name: "Place order" })).toBeDisabled();
  });

  it("adds products and adjusts quantities with exact totals", async () => {
    server.use(http.get("/api/showroom/products", () => HttpResponse.json(catalog())));
    const { user } = renderKiosk();

    const addBrakes = await screen.findByRole("button", { name: "Add Brake pads" });
    await user.click(addBrakes);
    await user.click(addBrakes);
    await user.click(addBrakes);
    await user.click(screen.getByRole("button", { name: "Add Trim clip" }));

    expect(within(panel()).getByText("4 items")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent("QAR 436.60");
    expect(screen.getAllByTestId("card-quantity")[0]).toHaveTextContent("3 in cart");

    await user.click(within(panel()).getByRole("button", { name: "One more Brake pads" }));
    expect(screen.getByTestId("cart-total")).toHaveTextContent("QAR 582.10");
    await user.click(within(panel()).getByRole("button", { name: "One less Trim clip" }));
    await waitFor(() => expect(within(panel()).queryByRole("button", { name: "Remove Trim clip" })).not.toBeInTheDocument());
    expect(within(panel()).getByText("4 items")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent("QAR 582.00");

    await user.click(within(panel()).getByRole("button", { name: "Remove Brake pads" }));
    expect(await within(panel()).findByText("Your cart is empty")).toBeInTheDocument();
  });

  it("validates the customer name, places the order idempotently and resets for the next customer", async () => {
    const requests: { body: unknown; key: string | null }[] = [];
    server.use(
      http.get("/api/showroom/products", () => HttpResponse.json(catalog())),
      http.post("/api/showroom/orders", async ({ request }) => {
        requests.push({ body: await request.json(), key: request.headers.get("idempotency-key") });
        // the first attempt fails (e.g. a network hiccup); the retry must reuse the key
        if (requests.length === 1) return HttpResponse.json({ statusCode: 503, message: "Unavailable" }, { status: 503 });
        return HttpResponse.json(orderFor("Sara Al-Kuwari"), { status: 201 });
      }),
    );
    const { user } = renderKiosk();

    const addBrakes = await screen.findByRole("button", { name: "Add Brake pads" });
    for (let i = 0; i < 3; i++) await user.click(addBrakes);
    await user.click(screen.getByRole("button", { name: "Add Trim clip" }));
    await user.click(within(panel()).getByRole("button", { name: "Place order" }));

    const dialog = await screen.findByRole("dialog", { name: "Almost done" });
    const name = within(dialog).getByLabelText("Customer name");
    expect(name).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Submit order" }));
    expect(await within(dialog).findByText("This field is required.")).toBeInTheDocument();

    await user.type(name, "4ever");
    await user.click(within(dialog).getByRole("button", { name: "Submit order" }));
    expect(await within(dialog).findByText("Letters and spaces only.")).toBeInTheDocument();
    expect(requests).toHaveLength(0);

    await user.clear(name);
    await user.type(name, "  Sara   Al-Kuwari ");
    await user.click(within(dialog).getByRole("button", { name: "Submit order" }));
    expect(await screen.findByText("Something went wrong on our side. Please try again.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Submit order" }));

    const code = await screen.findByTestId("order-code");
    expect(code).toHaveTextContent("GH-000042");
    expect(code).toHaveAttribute("dir", "ltr");
    expect(requests).toHaveLength(2);
    expect(requests[1].body).toEqual({
      items: [
        { productId: BRAKES.id, quantity: 3 },
        { productId: CLIP.id, quantity: 1 },
      ],
      customerName: "Sara Al-Kuwari",
      userId: staff.id,
    });
    expect(requests[0].key).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    expect(requests[1].key).toBe(requests[0].key);

    await user.click(screen.getByRole("button", { name: "Next customer" }));
    await waitFor(() => expect(screen.queryByTestId("order-code")).not.toBeInTheDocument());
    expect(within(panel()).getByText("Your cart is empty")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // a new checkout gets a new key
    await user.click(screen.getByRole("button", { name: "Add Trim clip" }));
    await user.click(within(panel()).getByRole("button", { name: "Place order" }));
    await user.type(await screen.findByLabelText("Customer name"), "Omar");
    await user.click(screen.getByRole("button", { name: "Submit order" }));
    await screen.findByTestId("order-code");
    expect(requests[2].key).not.toBe(requests[0].key);
  });

  it("drops unavailable products and explains why when the order is rejected", async () => {
    let listed = catalog();
    server.use(
      http.get("/api/showroom/products", () => HttpResponse.json(listed)),
      http.post("/api/showroom/orders", () => {
        listed = catalog([BRAKES]);
        return HttpResponse.json(
          { statusCode: 400, message: "Some products are no longer available.", code: "PRODUCT_UNAVAILABLE", productIds: [CLIP.id] },
          { status: 400 },
        );
      }),
    );
    const { user } = renderKiosk();

    await user.click(await screen.findByRole("button", { name: "Add Brake pads" }));
    await user.click(screen.getByRole("button", { name: "Add Trim clip" }));
    await user.click(within(panel()).getByRole("button", { name: "Place order" }));
    await user.type(await screen.findByLabelText("Customer name"), "Sara");
    await user.click(screen.getByRole("button", { name: "Submit order" }));

    const dialog = screen.getByRole("dialog", { name: "Almost done" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Some products are no longer available. Please check the cart.");
    // the page behind the dialog is aria-hidden while it is open, so query by text
    await waitFor(() => expect(screen.queryByText("Trim clip")).not.toBeInTheDocument());
    expect(within(panel()).getByText("Brake pads")).toBeInTheDocument();
    expect(within(panel()).getAllByTestId("line-quantity")).toHaveLength(1);
    expect(screen.getByTestId("cart-total")).toHaveTextContent("QAR 145.50");
  });

  it("sends signed-out tablets to the showroom sign-in", () => {
    renderWithApp(<ShowroomKiosk />, { user: null });
    expect(router.replace).toHaveBeenCalledWith("/showroom/login");
  });
});

describe("showroom kiosk timers", () => {
  it("clears a non-empty cart after 3 minutes without activity", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(http.get("/api/showroom/products", () => HttpResponse.json(catalog())));
    const { user } = renderKiosk();

    await user.click(await screen.findByRole("button", { name: "Add Brake pads" }));
    expect(within(panel()).getByText("1 item")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 10_000));
    // any touch restarts the countdown
    fireEvent.pointerDown(document.body);
    act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 10_000));
    expect(within(panel()).getByText("1 item")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(10_000));
    expect(within(panel()).getByText("Your cart is empty")).toBeInTheDocument();
    expect(await screen.findByText("The cart was cleared after a few minutes without activity.")).toBeInTheDocument();
  });

  it("returns to the product grid on its own after an order", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(
      http.get("/api/showroom/products", () => HttpResponse.json(catalog())),
      http.post("/api/showroom/orders", () => HttpResponse.json(orderFor("Sara"), { status: 201 })),
    );
    const { user } = renderKiosk();

    await user.click(await screen.findByRole("button", { name: "Add Brake pads" }));
    await user.click(within(panel()).getByRole("button", { name: "Place order" }));
    await user.type(await screen.findByLabelText("Customer name"), "Sara");
    await user.click(screen.getByRole("button", { name: "Submit order" }));
    await screen.findByTestId("order-code");

    act(() => vi.advanceTimersByTime(SUCCESS_RESET_MS));
    await waitFor(() => expect(screen.queryByTestId("order-code")).not.toBeInTheDocument());
    expect(within(panel()).getByText("Your cart is empty")).toBeInTheDocument();
  });
});
