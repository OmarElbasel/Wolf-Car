import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayInfo, SlotsView } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { renderWithApp } from "@/tests/render";
import { SlotsPage } from "./slots-page";

const NOW = new Date("2031-03-10T09:00:00.000Z");
const TODAY = "2031-03-10";
const cell = (date: string) => document.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)!;

function view(over: Partial<SlotsView> = {}): SlotsView {
  const state: Record<string, Partial<DayInfo>> = {
    "2031-03-12": { state: "FULL", fullCount: 1, lightCount: 1 },
    "2031-03-13": { state: "FULL", fullCount: 2 },
    "2031-03-14": { state: "CLOSED", reason: "National Day" },
    "2031-03-05": { state: "FULL", fullCount: 1 },
  };
  return {
    today: TODAY,
    days: Array.from({ length: 31 }, (_, i) => {
      const date = `2031-03-${String(i + 1).padStart(2, "0")}`;
      return { date, state: "OPEN", reason: null, fullCount: 0, lightCount: 0, ...state[date] };
    }),
    bookings: [
      { id: "b-1", type: "FULL", car: "Land Cruiser 2024", ownerName: "Khalid Al-Marri", phone: "55123456", receiveDate: "2031-03-12", deliveryDate: "2031-03-15" },
      { id: "b-2", type: "LIGHT", car: "Tesla Y", ownerName: "Noor", phone: null, receiveDate: "2031-03-12", deliveryDate: null },
      { id: "b-3", type: "FULL", car: "Patrol", ownerName: null, phone: null, receiveDate: "2031-03-13", deliveryDate: null },
      { id: "b-4", type: "FULL", car: "Tahoe", ownerName: null, phone: null, receiveDate: "2031-03-13", deliveryDate: null },
    ],
    requests: [
      { id: "r-1", date: "2031-03-12", type: "LIGHT", salesName: "Yousef", car: "Lexus LX", status: "REJECTED", decisionNote: "Workshop is full", createdAt: "2031-03-09T08:00:00.000Z" },
      { id: "r-0", date: "2031-03-11", type: "FULL", salesName: "Yousef", car: "GMC Yukon", status: "PENDING", decisionNote: null, createdAt: "2031-03-09T07:00:00.000Z" },
    ],
    ...over,
  };
}

const unlockPhone = () => {
  document.cookie = "wc_slots=1; path=/";
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  document.cookie = "wc_slots=; path=/; max-age=0";
});

describe("Sales slots page", () => {
  it("asks for the PIN on a new phone and opens with the right one", async () => {
    const pins: unknown[] = [];
    server.use(
      http.post("/api/slots/unlock", async ({ request }) => {
        const { pin } = (await request.json()) as { pin: string };
        pins.push(pin);
        if (pin !== "482915") return HttpResponse.json({ statusCode: 401, code: "SALES_PIN_INVALID", message: "x" }, { status: 401 });
        return HttpResponse.json({ expiresAt: "2031-06-08T09:00:00.000Z" });
      }),
      http.get("/api/slots", () => HttpResponse.json(view())),
    );
    const { user } = renderWithApp(<SlotsPage />, { user: null });

    const pin = await screen.findByLabelText("PIN");
    expect(screen.getByText(/Enter the PIN from the call center/)).toBeInTheDocument();
    await user.type(pin, "123");
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByText("Enter 6 digits.")).toBeInTheDocument();
    expect(pins).toEqual([]);

    await user.clear(pin);
    await user.type(pin, "000000");
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong PIN.");
    expect(pin).toHaveValue("");

    await user.type(pin, "٤٨٢٩١٥");
    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    expect(pins).toEqual(["000000", "482915"]);
  });

  it("tells the salesperson how long the PIN is locked", async () => {
    server.use(
      http.post("/api/slots/unlock", () =>
        HttpResponse.json({ statusCode: 423, code: "SALES_PIN_LOCKED", message: "x", retryAfterSeconds: 840 }, { status: 423 }),
      ),
    );
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await user.type(await screen.findByLabelText("PIN"), "482915");
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many wrong PINs. Try again in 14 min.");
  });

  it("opens straight away on a remembered phone and shows each kind of day", async () => {
    unlockPhone();
    let query = "";
    server.use(
      http.get("/api/slots", ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(view());
      }),
    );
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    expect(query).toBe("?from=2031-03-01&to=2031-03-31");
    expect(screen.queryByLabelText("PIN")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();

    // an open day: sales ask for it, and what they asked for shows as waiting, not as booked
    await user.click(cell("2031-03-11"));
    const day = screen.getByRole("region", { name: /11/ });
    expect(within(day).getByText("This day is open. Send a request to reserve it.")).toBeInTheDocument();
    expect(within(day).getByRole("button", { name: "Request this day for a full PPF" })).toBeInTheDocument();
    expect(within(day).getByRole("button", { name: "Request a light job" })).toBeInTheDocument();
    const waiting = within(day).getByRole("list", { name: "Waiting for the call center" });
    expect(within(waiting).getByText("GMC Yukon")).toBeInTheDocument();
    expect(within(waiting).getByText("Full PPF")).toBeInTheDocument();

    // one full PPF: a second may be asked for as an exception
    await user.click(cell("2031-03-12"));
    const full = screen.getByRole("region", { name: /12/ });
    expect(within(full).getByText("Closed: a full PPF car is booked.")).toBeInTheDocument();
    expect(within(full).getByText("Land Cruiser 2024")).toBeInTheDocument();
    expect(within(full).getByRole("button", { name: "Request a second full PPF (exception)" })).toBeInTheDocument();
    expect(within(full).getByRole("button", { name: "Request a light job" })).toBeInTheDocument();
    expect(within(full).queryByRole("list", { name: "Waiting for the call center" })).not.toBeInTheDocument();

    // two full PPF: only light jobs
    await user.click(cell("2031-03-13"));
    const two = screen.getByRole("region", { name: /13/ });
    expect(within(two).getByText("Closed: two full PPF cars are booked. Light jobs only.")).toBeInTheDocument();
    expect(within(two).getByText("Patrol")).toBeInTheDocument();
    expect(within(two).getByText("Tahoe")).toBeInTheDocument();
    expect(within(two).getAllByRole("button").map((b) => b.textContent)).toEqual(["Request a light job"]);

    await user.click(cell("2031-03-14"));
    const closed = screen.getByRole("region", { name: /14/ });
    expect(within(closed).getByText("Closed by the call center.")).toBeInTheDocument();
    expect(within(closed).getByText("National Day")).toBeInTheDocument();
    expect(within(closed).queryByRole("button")).not.toBeInTheDocument();

    // a full day that is already past takes no request
    await user.click(cell("2031-03-05"));
    expect(within(screen.getByRole("region", { name: /5/ })).queryByRole("button")).not.toBeInTheDocument();
  });

  it("asks the call center for an empty day: a request, not a booking", async () => {
    unlockPhone();
    const bodies: unknown[] = [];
    server.use(
      http.get("/api/slots", () => HttpResponse.json(view())),
      http.post("/api/slots/requests", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id: "r-3", date: "2031-03-11", type: "FULL", salesName: "Yousef", car: "Lexus LX", status: "PENDING", decisionNote: null, createdAt: NOW.toISOString() }, { status: 201 });
      }),
    );
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell("2031-03-11")).toBeEnabled());
    await user.click(cell("2031-03-11"));
    await user.click(screen.getByRole("button", { name: "Request this day for a full PPF" }));

    const dialog = await screen.findByRole("dialog", { name: "Request a full PPF" });
    expect(within(dialog).getByText(/The day is reserved only when the call center accepts/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    // the note is optional for a full PPF
    expect(await within(dialog).findAllByText("This field is required.")).toHaveLength(3);

    await user.type(within(dialog).getByLabelText("Your name"), "Yousef");
    await user.type(within(dialog).getByLabelText("Car"), "Lexus LX");
    await user.type(within(dialog).getByLabelText("Owner name"), "Sara Al-Kuwari");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(bodies).toEqual([{ date: "2031-03-11", type: "FULL", salesName: "Yousef", car: "Lexus LX", ownerName: "Sara Al-Kuwari", phone: "", note: "" }]);
  });

  it("says a second full PPF is an exception when asking for one", async () => {
    unlockPhone();
    server.use(http.get("/api/slots", () => HttpResponse.json(view())));
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    await user.click(screen.getByRole("button", { name: "Request a second full PPF (exception)" }));
    const dialog = await screen.findByRole("dialog", { name: "Request a full PPF" });
    expect(within(dialog).getByText(/This day already has a full PPF car/)).toBeInTheDocument();
  });

  it("sends a light-job request and remembers the salesperson's name", async () => {
    unlockPhone();
    const bodies: unknown[] = [];
    server.use(
      http.get("/api/slots", () => HttpResponse.json(view())),
      http.post("/api/slots/requests", async ({ request }) => {
        expect(request.headers.get("x-requested-with")).toBe("wolfcar");
        bodies.push(await request.json());
        return HttpResponse.json({ id: "r-2", date: "2031-03-12", type: "LIGHT", salesName: "Yousef", car: "Lexus LX", status: "PENDING", decisionNote: null, createdAt: NOW.toISOString() }, { status: 201 });
      }),
    );
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    await user.click(screen.getByRole("button", { name: "Request a light job" }));

    const dialog = await screen.findByRole("dialog", { name: "Request a light job" });
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(await within(dialog).findAllByText("This field is required.")).toHaveLength(4);

    await user.type(within(dialog).getByLabelText("Your name"), "Yousef");
    await user.type(within(dialog).getByLabelText("Car"), "Lexus LX");
    await user.type(within(dialog).getByLabelText("Owner name"), "Sara Al-Kuwari");
    await user.type(within(dialog).getByLabelText("What is the job?"), "Front windows tint");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(bodies).toEqual([{ date: "2031-03-12", type: "LIGHT", salesName: "Yousef", car: "Lexus LX", ownerName: "Sara Al-Kuwari", phone: "", note: "Front windows tint" }]);

    await user.click(screen.getByRole("button", { name: "Request a light job" }));
    expect(within(await screen.findByRole("dialog")).getByLabelText("Your name")).toHaveValue("Yousef");
  });

  it("explains a refused request inside the form", async () => {
    unlockPhone();
    server.use(
      http.get("/api/slots", () => HttpResponse.json(view())),
      http.post("/api/slots/requests", () => HttpResponse.json({ statusCode: 409, code: "PPF_DAY_FULL", message: "x" }, { status: 409 })),
    );
    localStorage.setItem("wc_sales_name", "Yousef");
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    await user.click(screen.getByRole("button", { name: "Request a light job" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Car"), "Lexus LX");
    await user.type(within(dialog).getByLabelText("Owner name"), "Sara");
    await user.type(within(dialog).getByLabelText("What is the job?"), "Tint");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This day already has two full PPF cars.");
  });

  it("the side panel opens and closes, listing booked cars and requests", async () => {
    unlockPhone();
    server.use(http.get("/api/slots", () => HttpResponse.json(view())));
    const { user } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    expect(screen.queryByRole("article", { name: "Land Cruiser 2024" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show booked cars" }));
    const car = await screen.findByRole("article", { name: "Land Cruiser 2024" });
    expect(within(car).getByText("Full PPF")).toBeInTheDocument();
    expect(within(car).getByText(/Khalid Al-Marri/)).toBeInTheDocument();
    expect(within(car).getByRole("link", { name: "55123456" })).toHaveAttribute("href", "tel:55123456");
    expect(within(car).getByText(/Receive:/)).toBeInTheDocument();
    expect(within(car).getByText(/Delivery:/)).toBeInTheDocument();
    const light = screen.getByRole("article", { name: "Tesla Y" });
    expect(within(light).getByText("Delivery not set")).toBeInTheDocument();

    const request = screen.getByRole("article", { name: "Lexus LX" });
    expect(within(request).getByText("Rejected")).toBeInTheDocument();
    expect(within(request).getByText("Workshop is full")).toBeInTheDocument();
    expect(within(request).getByText("Light job")).toBeInTheDocument();
    const asked = screen.getByRole("article", { name: "GMC Yukon" });
    expect(within(asked).getByText("Waiting")).toBeInTheDocument();
    expect(within(asked).getByText("Full PPF")).toBeInTheDocument();
  });

  it("goes back to the PIN screen when the PIN was changed, leaving no customer data on screen", async () => {
    unlockPhone();
    let allowed = true;
    server.use(
      http.get("/api/slots", () =>
        allowed
          ? HttpResponse.json(view())
          : HttpResponse.json({ statusCode: 401, code: "SALES_ACCESS_REQUIRED", message: "x" }, { status: 401 }),
      ),
    );
    const { user, queryClient } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    expect(screen.getByText("Land Cruiser 2024")).toBeInTheDocument();

    allowed = false;
    await queryClient.invalidateQueries({ queryKey: ["slots"] });
    expect(await screen.findByLabelText("PIN")).toBeInTheDocument();
    expect(screen.queryByText("Land Cruiser 2024")).not.toBeInTheDocument();
    expect(screen.queryByText(/Khalid/)).not.toBeInTheDocument();
  });

  it("works in Arabic", async () => {
    unlockPhone();
    server.use(http.get("/api/slots", () => HttpResponse.json(view())));
    const { user } = renderWithApp(<SlotsPage />, { user: null, locale: "ar" });
    await waitFor(() => expect(cell("2031-03-12")).toBeEnabled());
    await user.click(cell("2031-03-12"));
    expect(screen.getByRole("button", { name: "طلب خدمة خفيفة" })).toBeInTheDocument();
  });

  it("says so when it cannot refresh, instead of showing old availability as current", async () => {
    unlockPhone();
    let ok = true;
    server.use(http.get("/api/slots", () => (ok ? HttpResponse.json(view()) : HttpResponse.json({ statusCode: 500, message: "x" }, { status: 500 }))));
    const { queryClient } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    ok = false;
    await queryClient.invalidateQueries({ queryKey: ["slots"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't refresh. This may be out of date.");
    expect(cell(TODAY)).toBeInTheDocument();
  });

  it("moves on by itself when the month rolls over on a page left open", async () => {
    unlockPhone();
    const calls: string[] = [];
    let firstOpenMonth = "2031-03-01";
    server.use(
      http.get("/api/slots", ({ request }) => {
        const from = new URL(request.url).searchParams.get("from") ?? "";
        calls.push(from);
        // the API serves the current month onwards only
        if (from < firstOpenMonth) return HttpResponse.json({ statusCode: 400, code: "BAD_RANGE", message: "x" }, { status: 400 });
        return HttpResponse.json(view());
      }),
    );
    const { queryClient } = renderWithApp(<SlotsPage />, { user: null });
    await waitFor(() => expect(cell(TODAY)).toBeEnabled());

    vi.setSystemTime(new Date("2031-04-01T09:00:00.000Z"));
    firstOpenMonth = "2031-04-01";
    await queryClient.invalidateQueries({ queryKey: ["slots"] });
    await waitFor(() => expect(calls.at(-1)).toBe("2031-04-01"));
    expect(screen.getByRole("heading", { name: "April 2031" })).toBeInTheDocument();
  });
});
