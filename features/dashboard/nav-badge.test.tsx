import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { DashboardShell } from "./shell";

const amani = makeUser({ role: "RESERVATIONS", branch: null, permissions: ["booking.ppf.read", "booking.ppf.manage", "booking.general.manage"] });

describe("PPF requests counter in the menu", () => {
  it("shows how many light-job requests are waiting", async () => {
    let query = "";
    server.use(
      http.get("/api/ppf/requests", ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({ items: [], page: 1, pageSize: 1, total: 2 });
      }),
    );
    renderWithApp(<DashboardShell>content</DashboardShell>, { user: amani });
    expect(await screen.findByText("2 requests waiting")).toBeInTheDocument();
    expect(query).toContain("status=PENDING");
    expect(screen.getByRole("link", { name: /PPF bookings/ })).toHaveAttribute("href", "/dashboard/ppf-bookings");
    expect(screen.getByRole("link", { name: "General reservations" })).toBeInTheDocument();
  });

  it("asks for nothing when the user cannot see PPF bookings", () => {
    // MSW is set to fail on unhandled requests, so a stray call would fail this test
    renderWithApp(<DashboardShell>content</DashboardShell>, { user: makeUser({ permissions: ["order.read.branch"] }) });
    expect(screen.queryByRole("link", { name: /PPF bookings/ })).not.toBeInTheDocument();
  });
});
