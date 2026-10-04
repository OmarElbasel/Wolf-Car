import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import arApp from "@/messages/app/ar";
import enApp from "@/messages/app/en";
import { ROLES } from "@/shared/permissions";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { Overview } from "./overview";

describe("Overview", () => {
  it("has a subtitle for every role, in both languages", () => {
    for (const messages of [enApp, arApp]) {
      expect(Object.keys(messages.Dashboard.subtitle).sort()).toEqual([...ROLES].sort());
    }
  });

  it("greets the call center and shows the requests waiting for her", async () => {
    server.use(http.get("/api/ppf/requests", () => HttpResponse.json({ items: [], page: 1, pageSize: 1, total: 3 })));
    const amani = makeUser({ role: "RESERVATIONS", displayName: "Amani", branch: null, permissions: ["booking.ppf.read", "booking.ppf.manage", "booking.general.manage"] });
    renderWithApp(<Overview />, { user: amani });
    expect(screen.getByText("PPF bookings and general reservations.")).toBeInTheDocument();
    const stat = await screen.findByRole("link", { name: /Requests waiting/ });
    expect(stat).toHaveAttribute("href", "/dashboard/ppf-bookings");
    await waitFor(() => expect(stat).toHaveTextContent("3"));
  });
});
