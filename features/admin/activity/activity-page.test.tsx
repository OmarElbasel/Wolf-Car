import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { ActivityEntry } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { resetAdminTestState } from "../shared/test-utils";
import { ActivityPage } from "./activity-page";

const entry = (overrides: Partial<ActivityEntry>): ActivityEntry => ({
  id: "1",
  occurredAt: "2026-09-21T10:00:00.000Z",
  action: "auth.login",
  outcome: "SUCCESS",
  actor: { id: "u1", username: "admin", role: "SUPER_ADMIN" },
  branch: null,
  entityType: "Session",
  entityId: "96275ca7-ad9b-4011-b5e9-fb059e9b5792",
  before: null,
  after: null,
  metadata: null,
  ip: "10.0.0.7",
  userAgent: "Mozilla/5.0 (Macintosh)",
  requestId: "a361a081-321e-43b3-a0fa-d112dd14229f",
  ...overrides,
});

const ENTRIES: ActivityEntry[] = [
  entry({
    id: "3",
    action: "product.price.update",
    actor: { id: "u2", username: "finance", role: "FINANCE" },
    entityType: "Product",
    entityId: "5b1d7c2e-1111-4111-8111-111111111111",
    before: { name: "Oil filter", price: "10.00" },
    after: { name: "Oil filter", price: "12.50" },
    branch: { id: "b-gh", code: "GH", name: "Al Gharrafa Branch", nameAr: "فرع الغرافة" },
  }),
  entry({
    id: "2",
    action: "order.confirm",
    entityType: "Order",
    entityId: "7f3e0000-2222-4222-8222-222222222222",
    metadata: { code: "GH-000042" },
  }),
  entry({ id: "1", action: "auth.login", outcome: "FAILURE", actor: { id: null, username: "ghost", role: null }, metadata: { reason: "INVALID_CREDENTIALS" } }),
];

const admin = makeUser({ role: "SUPER_ADMIN", branch: null, permissions: ["activity.read"] });

function mockLog() {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get("/api/activity", ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items: ENTRIES, page: 1, pageSize: 25, total: ENTRIES.length });
    }),
    http.get("/api/activity/actions", () => HttpResponse.json(["auth.login", "order.confirm", "product.price.update"])),
    http.get("/api/branches/options", () =>
      HttpResponse.json([{ id: "b-gh", code: "GH", name: "Al Gharrafa Branch", nameAr: "فرع الغرافة", isActive: true }]),
    ),
  );
  return queries;
}

beforeEach(() => resetAdminTestState("/en/dashboard/activity"));

describe("Activity log", () => {
  it("needs activity.read", () => {
    renderWithApp(<ActivityPage />, { user: makeUser({ permissions: [] }) });
    expect(screen.getByRole("alert")).toHaveTextContent("View the activity log");
  });

  it("shows translated actions, failures, targets and branches", async () => {
    mockLog();
    renderWithApp(<ActivityPage />, { user: admin });
    const price = (await screen.findByText("Price changed")).closest("tr") as HTMLElement;
    expect(within(price).getByText("finance")).toBeInTheDocument();
    expect(within(price).getByText("Product")).toBeInTheDocument();
    expect(within(price).getByText("5b1d7c2e")).toBeInTheDocument();
    expect(within(price).getByText("Al Gharrafa Branch")).toBeInTheDocument();

    const order = screen.getByText("Order confirmed").closest("tr") as HTMLElement;
    expect(within(order).getByText("GH-000042")).toBeInTheDocument();

    const failed = screen.getByText("Sign in").closest("tr") as HTMLElement;
    expect(within(failed).getByText("Failed")).toBeInTheDocument();
    expect(within(failed).getByText("INVALID_CREDENTIALS")).toBeInTheDocument();
    expect(within(failed).getByText("ghost")).toBeInTheDocument();
  });

  it("expands a row to show before/after with the changed keys highlighted", async () => {
    mockLog();
    const { user } = renderWithApp(<ActivityPage />, { user: admin });
    const row = (await screen.findByText("Price changed")).closest("tr") as HTMLElement;
    const toggle = within(row).getByRole("button", { name: "Details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const details = document.getElementById(toggle.getAttribute("aria-controls") ?? "") as HTMLElement;
    const before = within(details).getByRole("region", { name: "Before" });
    const after = within(details).getByRole("region", { name: "After" });
    expect(before).toHaveTextContent('"price": "10.00"');
    expect(after).toHaveTextContent('"price": "12.50"');
    expect(within(after).getByText(/"price": "12.50"/).closest("[data-changed]")).not.toBeNull();
    expect(within(after).getByText(/"name": "Oil filter"/).closest("[data-changed]")).toBeNull();
    expect(within(details).getByText("10.0.0.7")).toBeInTheDocument();
    expect(within(details).getByText("a361a081-321e-43b3-a0fa-d112dd14229f")).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(within(details).queryByRole("region", { name: "Before" })).not.toBeInTheDocument());
  });

  it("puts the filters in the request query", async () => {
    const queries = mockLog();
    const { user } = renderWithApp(<ActivityPage />, { user: admin });
    await screen.findByText("Price changed");
    expect(queries[0].get("pageSize")).toBe("25");

    await user.click(screen.getByRole("combobox", { name: "Action" }));
    await user.click(await screen.findByRole("option", { name: "Orders (all)" }));
    await waitFor(() => expect(queries.at(-1)?.get("action")).toBe("order."));

    await user.click(screen.getByRole("combobox", { name: "Result" }));
    await user.click(await screen.findByRole("option", { name: "Failed" }));
    await waitFor(() => expect(queries.at(-1)?.get("outcome")).toBe("FAILURE"));

    await user.type(screen.getByRole("searchbox", { name: "Username" }), "fin");
    await waitFor(() => expect(queries.at(-1)?.get("actor")).toBe("fin"));

    await user.click(screen.getByRole("combobox", { name: "Branch" }));
    await user.click(await screen.findByRole("option", { name: "Al Gharrafa Branch" }));
    await waitFor(() => expect(queries.at(-1)?.get("branchId")).toBe("b-gh"));

    await user.click(screen.getByRole("combobox", { name: "Target type" }));
    await user.click(await screen.findByRole("option", { name: "Order" }));
    await waitFor(() => expect(queries.at(-1)?.get("entityType")).toBe("Order"));

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-21" } });
    await waitFor(() => {
      const last = queries.at(-1);
      expect(last?.get("from")).toBe("2026-09-01");
      expect(last?.get("to")).toBe("2026-09-21");
      expect(last?.get("action")).toBe("order.");
      expect(last?.get("actor")).toBe("fin");
    });
    expect(window.location.search).toContain("entity=Order");

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => {
      const last = queries.at(-1);
      expect([...(last?.keys() ?? [])].sort()).toEqual(["page", "pageSize"]);
    });
    expect(screen.getByRole("searchbox", { name: "Username" })).toHaveValue("");
  });
});
