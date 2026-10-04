import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LightJobRequest } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { calendarOf, NOW, page, TODAY, registerPpfDefaults } from "./ppf-fixtures";
import { PpfBookingsPage } from "./ppf-bookings-page";

const amani = makeUser({ role: "RESERVATIONS", branch: null, permissions: ["booking.ppf.read", "booking.ppf.manage"] });
const viewer = makeUser({ role: "FINANCE", branch: null, permissions: ["booking.ppf.read"] });

const request = (over: Partial<LightJobRequest> = {}): LightJobRequest => ({
  id: "r-1",
  date: TODAY,
  type: "LIGHT",
  salesName: "Yousef",
  car: "Lexus LX",
  ownerName: "Sara Al-Kuwari",
  phone: "55123456",
  note: "Front windows tint",
  status: "PENDING",
  decisionNote: null,
  decidedAt: null,
  bookingId: null,
  createdAt: "2031-03-10T08:00:00.000Z",
  ...over,
});

/** Serves a mutable list for both the inbox and the waiting counter. */
function serveRequests(list: LightJobRequest[]) {
  server.use(
    http.get("/api/ppf/requests", ({ request: req }) => {
      const status = new URL(req.url).searchParams.get("status");
      return HttpResponse.json(page(status ? list.filter((r) => r.status === status) : list));
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  registerPpfDefaults();
  server.use(http.get("/api/ppf/calendar", () => HttpResponse.json(calendarOf([]))));
});
afterEach(() => vi.useRealTimers());

async function openRequests(user: ReturnType<typeof renderWithApp>["user"]) {
  await user.click(await screen.findByRole("tab", { name: /Requests/ }));
}

describe("PPF requests inbox", () => {
  it("shows how many are waiting on the tab, and each request in full", async () => {
    serveRequests([request(), request({ id: "r-2", car: "Tesla Y", status: "REJECTED", decisionNote: "Workshop is full" })]);
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    expect(await screen.findByRole("tab", { name: /Requests.*1 request waiting/ })).toBeInTheDocument();
    await openRequests(user);

    const card = await screen.findByRole("article", { name: "Lexus LX" });
    expect(within(card).getByText("Waiting")).toBeInTheDocument();
    expect(within(card).getByText(/Yousef/)).toBeInTheDocument();
    expect(within(card).getByText("Front windows tint")).toBeInTheDocument();
    expect(within(card).getByText("55123456")).toBeInTheDocument();
    expect(within(card).getByText("Light job")).toBeInTheDocument();
    const answered = screen.getByRole("article", { name: "Tesla Y" });
    expect(within(answered).getByText("Rejected")).toBeInTheDocument();
    expect(within(answered).getByText("Workshop is full")).toBeInTheDocument();
    expect(within(answered).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a full PPF request as one, with or without a note", async () => {
    serveRequests([request({ type: "FULL", note: null })]);
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await openRequests(user);
    const card = await screen.findByRole("article", { name: "Lexus LX" });
    expect(within(card).getByText("Full PPF")).toBeInTheDocument();
    expect(within(card).queryByText("Front windows tint")).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("approves a request", async () => {
    const list = [request()];
    serveRequests(list);
    let approved = false;
    server.use(
      http.post("/api/ppf/requests/r-1/approve", () => {
        approved = true;
        list[0] = request({ status: "APPROVED", bookingId: "b-9" });
        return HttpResponse.json(list[0]);
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await openRequests(user);
    const card = await screen.findByRole("article", { name: "Lexus LX" });
    await user.click(within(card).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approved).toBe(true));
    expect(await within(screen.getByRole("article", { name: "Lexus LX" })).findByText("Approved")).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "Requests" })).toBeInTheDocument(); // counter gone
  });

  it("rejects with a reason the salesperson will see", async () => {
    const list = [request()];
    serveRequests(list);
    let body: unknown;
    server.use(
      http.post("/api/ppf/requests/r-1/reject", async ({ request: req }) => {
        body = await req.json();
        list[0] = request({ status: "REJECTED", decisionNote: "Workshop is full" });
        return HttpResponse.json(list[0]);
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await openRequests(user);
    await user.click(within(await screen.findByRole("article", { name: "Lexus LX" })).getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject this request?" });
    await user.type(within(dialog).getByLabelText(/Reason/), "Workshop is full");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(body).toEqual({ decisionNote: "Workshop is full" }));
    expect(await screen.findByText("Workshop is full")).toBeInTheDocument();
  });

  it("when someone else already answered, says so and shows the real state", async () => {
    const list = [request()];
    serveRequests(list);
    server.use(
      http.post("/api/ppf/requests/r-1/approve", () => {
        list[0] = request({ status: "REJECTED", decisionNote: "Answered in another tab" });
        return HttpResponse.json({ statusCode: 409, code: "REQUEST_ALREADY_DECIDED", message: "x" }, { status: 409 });
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await openRequests(user);
    await user.click(within(await screen.findByRole("article", { name: "Lexus LX" })).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("This request was already answered.")).toBeInTheDocument();
    expect(await screen.findByText("Answered in another tab")).toBeInTheDocument();
  });

  it("view-only users can read requests but not answer them", async () => {
    serveRequests([request()]);
    const { user } = renderWithApp(<PpfBookingsPage />, { user: viewer });
    await openRequests(user);
    expect(within(await screen.findByRole("article", { name: "Lexus LX" })).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Sales page card", () => {
  it("shows the link and that no PIN is set, then sets one", async () => {
    let body: unknown;
    let pinSet = false;
    server.use(
      http.get("/api/ppf/sales-access", () => HttpResponse.json({ pinSet, updatedAt: pinSet ? "2031-03-10T09:00:00.000Z" : null })),
      http.put("/api/ppf/sales-access/pin", async ({ request: req }) => {
        body = await req.json();
        pinSet = true;
        return HttpResponse.json({ pinSet: true, updatedAt: "2031-03-10T09:00:00.000Z" });
      }),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    const card = await screen.findByRole("region", { name: "Sales page" });
    expect(await within(card).findByText(/No PIN yet/)).toBeInTheDocument();
    expect(within(card).getByText("http://localhost:3000/en/slots")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Set PIN" }));
    const dialog = await screen.findByRole("dialog", { name: "Sales PIN" });
    await user.type(within(dialog).getByLabelText("PIN"), "12345");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Enter 6 digits.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Generate" }));
    const pin = (within(dialog).getByLabelText("PIN") as HTMLInputElement).value;
    expect(pin).toMatch(/^\d{6}$/);
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).toEqual({ pin }));
    expect(await within(card).findByText("A PIN is set.")).toBeInTheDocument();
    expect(await within(card).findByRole("button", { name: "Change PIN" })).toBeInTheDocument();
  });

  it("view-only users see the link but cannot change the PIN", async () => {
    renderWithApp(<PpfBookingsPage />, { user: viewer });
    const card = await screen.findByRole("region", { name: "Sales page" });
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

describe("PPF requests inbox: long lists", () => {
  it("says when older requests are not shown", async () => {
    server.use(
      http.get("/api/ppf/requests", ({ request: req }) =>
        new URL(req.url).searchParams.get("status")
          ? HttpResponse.json({ items: [], page: 1, pageSize: 1, total: 0 })
          : HttpResponse.json({ items: [request()], page: 1, pageSize: 50, total: 73 }),
      ),
    );
    const { user } = renderWithApp(<PpfBookingsPage />, { user: amani });
    await openRequests(user);
    expect(await screen.findByText("Showing the newest 1 of 73 requests.")).toBeInTheDocument();
  });
});
});
