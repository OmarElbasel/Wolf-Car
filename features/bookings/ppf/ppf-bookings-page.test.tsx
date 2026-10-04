import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PpfBooking } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { booking, calendarOf, NOW, TODAY, registerPpfDefaults } from "./ppf-fixtures";
import { PpfBookingsPage } from "./ppf-bookings-page";

const amani = makeUser({ role: "RESERVATIONS", branch: null, permissions: ["booking.ppf.read", "booking.ppf.manage", "booking.general.manage"] });
const viewer = makeUser({ role: "FINANCE", branch: null, permissions: ["booking.ppf.read"] });
const cell = (date: string) => document.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)!;

/** Serves `bookings` as March 2031 and records what the page asked for. */
function serveCalendar(bookings: PpfBooking[], closed: Record<string, string | null> = {}) {
  const calls: string[] = [];
  server.use(
    http.get("/api/ppf/calendar", ({ request }) => {
      calls.push(new URL(request.url).search);
      return HttpResponse.json(calendarOf(bookings, closed));
    }),
  );
  return calls;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  registerPpfDefaults();
});
afterEach(() => vi.useRealTimers());

describe("PPF bookings page", () => {
  it("needs booking.ppf.read", () => {
    renderWithApp(<PpfBookingsPage />, { user: makeUser({ permissions: ["order.read.branch"] }) });
    expect(screen.getByRole("alert")).toHaveTextContent("View PPF bookings");
  });

  it("opens on today's month and lists today's bookings", async () => {
    const calls = serveCalendar([booking(), booking({ id: "b-2", type: "LIGHT", car: "Lexus LX", service: "Tint", requestedBy: "Yousef", deliveryDate: null })]);
    renderWithApp(<PpfBookingsPage />, { user: amani });

    const full = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    expect(calls[0]).toBe("?from=2031-03-01&to=2031-03-31");
    expect(cell(TODAY)).toHaveAttribute("data-state", "FULL");
    expect(within(full).getByText("Full PPF")).toBeInTheDocument();
    expect(within(full).getByText(/Khalid Al-Marri/)).toBeInTheDocument();
    expect(within(full).getByText("55123456")).toBeInTheDocument();
    expect(within(full).getByText(/Delivery:/)).toBeInTheDocument();
    const light = screen.getByRole("article", { name: "Lexus LX" });
    expect(within(light).getByText(/Requested by .*Yousef/)).toBeInTheDocument();
  });

  it("adds a booking on the selected day", async () => {
    let body: unknown;
    const bookings: PpfBooking[] = [];
    serveCalendar(bookings);
    server.use(
      http.post("/api/ppf/bookings", async ({ request }) => {
        body = await request.json();
        bookings.push(booking({ id: "b-9", receiveDate: "2031-03-12", car: "Patrol" }));
        return HttpResponse.json(bookings[0], { status: 201 });
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    await user.click(screen.getByRole("button", { name: "Add booking" }));

    const dialog = await screen.findByRole("dialog", { name: "New booking" });
    expect(within(dialog).getByRole("radio", { name: /Full PPF/ })).toBeChecked();
    expect(within(dialog).getByLabelText("Receive day")).toHaveValue("2031-03-12");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findAllByText("This field is required.")).toHaveLength(1);

    await user.type(within(dialog).getByLabelText("Car"), "Patrol");
    await user.type(within(dialog).getByLabelText(/Owner name/), "Hamad Al-Thani");
    await user.type(within(dialog).getByLabelText(/Phone/), "٥٥٩٩٨٨٧٧");
    fireEvent.change(within(dialog).getByLabelText(/Delivery day/), { target: { value: "2031-03-15" } });
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(body).toEqual({
      type: "FULL",
      car: "Patrol",
      ownerName: "Hamad Al-Thani",
      phone: "55998877",
      service: "",
      receiveDate: "2031-03-12",
      deliveryDate: "2031-03-15",
      note: "",
    });
    expect(await screen.findByRole("article", { name: "Patrol" })).toBeInTheDocument();
  });

  it("refuses a delivery day before the receive day without calling the server", async () => {
    serveCalendar([]);
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Add booking" }));
    const dialog = await screen.findByRole("dialog", { name: "New booking" });
    await user.type(within(dialog).getByLabelText("Car"), "Patrol");
    await user.type(within(dialog).getByLabelText(/Owner name/), "Hamad");
    fireEvent.change(within(dialog).getByLabelText(/Delivery day/), { target: { value: "2031-03-09" } });
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("The delivery day can't be before the receive day.")).toBeInTheDocument();
  });

  it("says so when the day already has two full PPF cars, and keeps what was typed", async () => {
    serveCalendar([]);
    server.use(http.post("/api/ppf/bookings", () => HttpResponse.json({ statusCode: 409, code: "PPF_DAY_FULL", message: "taken" }, { status: 409 })));
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Add booking" }));
    const dialog = await screen.findByRole("dialog", { name: "New booking" });
    await user.type(within(dialog).getByLabelText("Car"), "Patrol");
    await user.type(within(dialog).getByLabelText(/Owner name/), "Hamad");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This day already has two full PPF cars.");
    expect(within(dialog).getByLabelText("Car")).toHaveValue("Patrol");
  });

  it("edits a booking, sending cleared fields as empty", async () => {
    let body: Record<string, unknown> = {};
    serveCalendar([booking()]);
    server.use(
      http.patch("/api/ppf/bookings/b-1", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(booking());
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    const card = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    await user.click(within(card).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit booking" });
    expect(within(dialog).getByLabelText("Car")).toHaveValue("Land Cruiser 2024");
    await user.clear(within(dialog).getByLabelText(/Phone/));
    await user.click(within(dialog).getByRole("radio", { name: /Light job/ }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).toMatchObject({ type: "LIGHT", phone: "", car: "Land Cruiser 2024", deliveryDate: "2031-03-13" }));
  });

  it("cancels a booking after confirming; a cancelled one has no actions", async () => {
    const bookings = [booking()];
    serveCalendar(bookings);
    let cancelled = false;
    server.use(
      http.post("/api/ppf/bookings/b-1/cancel", () => {
        cancelled = true;
        bookings[0] = booking({ status: "CANCELLED", cancelledAt: "2031-03-10T09:00:00.000Z" });
        return HttpResponse.json(bookings[0]);
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    const card = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    await user.click(within(card).getByRole("button", { name: "Cancel booking" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Cancel this booking?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancel booking" }));

    await waitFor(() => expect(cancelled).toBe(true));
    await waitFor(() => expect(cell(TODAY)).toHaveAttribute("data-state", "OPEN"));
    // the confirmation dialog hides the page from the accessibility tree until it has closed
    const after = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    expect(within(after).getByText("Cancelled")).toBeInTheDocument();
    expect(within(after).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("closes a day with a reason and reopens it", async () => {
    const closed: Record<string, string | null> = {};
    serveCalendar([], closed);
    let reason: unknown;
    server.use(
      http.put(`/api/ppf/closed-days/${TODAY}`, async ({ request }) => {
        reason = ((await request.json()) as { reason: string }).reason;
        closed[TODAY] = "National Day";
        return HttpResponse.json({ date: TODAY, reason: "National Day" });
      }),
      http.delete(`/api/ppf/closed-days/${TODAY}`, () => {
        delete closed[TODAY];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Close day" }));
    const dialog = await screen.findByRole("dialog", { name: "Close this day?" });
    await user.type(within(dialog).getByLabelText(/Reason/), "National Day");
    await user.click(within(dialog).getByRole("button", { name: "Close day" }));

    expect(await screen.findByText(/Closed: .*National Day/)).toBeInTheDocument();
    expect(reason).toBe("National Day");
    expect(screen.queryByRole("button", { name: "Add booking" })).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Reopen day" }));
    expect(await screen.findByRole("button", { name: "Add booking" })).toBeInTheDocument();
  });

  it("view-only users see the calendar without any buttons that change it", async () => {
    serveCalendar([booking()]);
    renderWithApp(<PpfBookingsPage />, { user: viewer });
    const card = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    for (const name of ["Add booking", "Close day"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("changing month loads that month and selects its first day", async () => {
    const calls = serveCalendar([]);
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Next month" }));
    await waitFor(() => expect(calls.at(-1)).toBe("?from=2031-04-01&to=2031-04-30"));
    expect(screen.getByRole("heading", { name: "April 2031" })).toBeInTheDocument();
  });

  it("saves a booking with only the car, and shows it without an owner", async () => {
    let body: Record<string, unknown> = {};
    const bookings: PpfBooking[] = [];
    serveCalendar(bookings);
    server.use(
      http.post("/api/ppf/bookings", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        bookings.push(booking({ id: "b-7", car: "Patrol", ownerName: null, phone: null, service: null, deliveryDate: null }));
        return HttpResponse.json(bookings[0], { status: 201 });
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Add booking" }));
    const dialog = await screen.findByRole("dialog", { name: "New booking" });
    await user.type(within(dialog).getByLabelText("Car"), "Patrol");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).toMatchObject({ car: "Patrol", ownerName: "" }));
    expect(await screen.findByRole("article", { name: "Patrol" })).toBeInTheDocument();
  });
});
