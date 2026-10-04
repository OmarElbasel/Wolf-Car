import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneralReservation } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { ReservationsPage } from "./reservations-page";

const amani = makeUser({ role: "RESERVATIONS", branch: null, permissions: ["booking.general.manage"] });
const NOW = new Date("2031-03-10T09:00:00.000Z");

const reservation = (over: Partial<GeneralReservation> = {}): GeneralReservation => ({
  id: "g-1",
  date: "2031-03-10",
  time: "16:30",
  service: "Ceramic coating",
  ownerName: "Sara Al-Kuwari",
  phone: "55123456",
  car: "Lexus LX",
  note: null,
  status: "BOOKED",
  createdBy: { id: "u-1", displayName: "Amani" },
  createdAt: "2031-03-01T08:00:00.000Z",
  cancelledAt: null,
  ...over,
});

/** Serves a mutable list and records every query string the page sends. */
function serve(list: GeneralReservation[]) {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get("/api/reservations", ({ request }) => {
      calls.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items: list, page: 1, pageSize: 100, total: list.length });
    }),
  );
  return calls;
}

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: NOW }));
afterEach(() => vi.useRealTimers());

describe("General reservations page", () => {
  it("needs booking.general.manage", () => {
    renderWithApp(<ReservationsPage />, { user: makeUser({ permissions: ["booking.ppf.read"] }) });
    expect(screen.getByRole("alert")).toHaveTextContent("Manage general reservations");
  });

  it("lists from today, active only, grouped by day", async () => {
    const calls = serve([reservation(), reservation({ id: "g-2", date: "2031-03-12", time: null, service: "Polish", ownerName: null, phone: null, car: null })]);
    renderWithApp(<ReservationsPage />, { user: amani });

    const first = await screen.findByRole("article", { name: "Ceramic coating" });
    expect(Object.fromEntries(calls[0])).toEqual({ from: "2031-03-10", status: "BOOKED", pageSize: "100" });
    expect(within(first).getByText("16:30")).toBeInTheDocument();
    expect(within(first).getByText(/Sara Al-Kuwari/)).toBeInTheDocument();
    expect(within(first).getByText("Lexus LX")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getByRole("article", { name: "Polish" })).toBeInTheDocument();
  });

  it("adds a reservation with only a day and a service", async () => {
    const list: GeneralReservation[] = [];
    serve(list);
    let body: unknown;
    server.use(
      http.post("/api/reservations", async ({ request }) => {
        body = await request.json();
        list.push(reservation({ id: "g-9", service: "Seat covers", time: null, ownerName: null, phone: null, car: null }));
        return HttpResponse.json(list[0], { status: 201 });
      }),
    );
    const { user } = renderWithApp(<ReservationsPage />, { user: amani });
    await screen.findByText("No reservations in this range.");
    await user.click(screen.getByRole("button", { name: "Add reservation" }));
    const dialog = await screen.findByRole("dialog", { name: "New reservation" });
    expect(within(dialog).getByLabelText("Day")).toHaveValue("2031-03-10");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("This field is required.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Service"), "Seat covers");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(body).toEqual({ date: "2031-03-10", time: "", service: "Seat covers", ownerName: "", phone: "", car: "", note: "" });
    expect(await screen.findByRole("article", { name: "Seat covers" })).toBeInTheDocument();
  });

  it("edits a reservation: clears the hour and moves the day", async () => {
    serve([reservation()]);
    let body: Record<string, unknown> = {};
    server.use(
      http.patch("/api/reservations/g-1", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(reservation());
      }),
    );
    const { user } = renderWithApp(<ReservationsPage />, { user: amani });
    await user.click(within(await screen.findByRole("article", { name: "Ceramic coating" })).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit reservation" });
    fireEvent.change(within(dialog).getByLabelText(/Hour/), { target: { value: "" } });
    fireEvent.change(within(dialog).getByLabelText("Day"), { target: { value: "2031-03-11" } });
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).toMatchObject({ time: "", date: "2031-03-11", service: "Ceramic coating", ownerName: "Sara Al-Kuwari" }));
  });

  it("cancels after confirming", async () => {
    const list = [reservation()];
    serve(list);
    let cancelled = false;
    server.use(
      http.post("/api/reservations/g-1/cancel", () => {
        cancelled = true;
        list.length = 0;
        return HttpResponse.json(reservation({ status: "CANCELLED" }));
      }),
    );
    const { user } = renderWithApp(<ReservationsPage />, { user: amani });
    await user.click(within(await screen.findByRole("article", { name: "Ceramic coating" })).getByRole("button", { name: "Cancel reservation" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Cancel this reservation?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancel reservation" }));
    await waitFor(() => expect(cancelled).toBe(true));
    expect(await screen.findByText("No reservations in this range.")).toBeInTheDocument();
  });

  it("searches, changes the range and can include cancelled ones", async () => {
    const calls = serve([reservation({ status: "CANCELLED", cancelledAt: "2031-03-09T08:00:00.000Z" })]);
    const { user } = renderWithApp(<ReservationsPage />, { user: amani });
    const card = await screen.findByRole("article", { name: "Ceramic coating" });
    expect(within(card).getByText("Cancelled")).toBeInTheDocument();
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search name, phone, car or service" }), "lexus");
    await waitFor(() => expect(calls.at(-1)?.get("q")).toBe("lexus"));
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2031-03-31" } });
    await waitFor(() => expect(calls.at(-1)?.get("to")).toBe("2031-03-31"));
    await user.click(screen.getByRole("checkbox", { name: "Show cancelled" }));
    await waitFor(() => expect(calls.at(-1)?.has("status")).toBe(false));
  });

  it("says when the list is cut short", async () => {
    server.use(http.get("/api/reservations", () => HttpResponse.json({ items: [reservation()], page: 1, pageSize: 100, total: 140 })));
    renderWithApp(<ReservationsPage />, { user: amani });
    expect(await screen.findByText("Showing the first 1 of 140. Narrow the dates or search to see the rest.")).toHaveAttribute("role", "status");
  });
});
