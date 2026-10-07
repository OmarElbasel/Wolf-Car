import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { OdooSyncBar, type OdooSyncStatus } from "./odoo-sync-bar";

const finance = makeUser({ permissions: ["product.read", "product.update.price"] });
const manager = makeUser({ permissions: ["product.read"] });

const run = { id: "r-1", startedAt: "2031-03-10T08:45:00.000Z", finishedAt: "2031-03-10T08:45:20.000Z", byUser: false, ok: true, error: null };
const status = (over: Partial<OdooSyncStatus> = {}): OdooSyncStatus => ({
  configured: true,
  running: false,
  everyMinutes: 15,
  last: { ...run, summary: { imported: 1130, created: 0, updated: 2, repriced: 1, switchedOff: 0, warnings: 0 } },
  lastOk: { ...run, summary: { imported: 1130, created: 0, updated: 2, repriced: 1, switchedOff: 0, warnings: 0 } },
  ...over,
});

describe("Odoo sync bar", () => {
  it("shows nothing until Odoo is connected", async () => {
    let asked = false;
    server.use(http.get("/api/odoo/sync", () => ((asked = true), HttpResponse.json(status({ configured: false, last: null, lastOk: null })))));
    const { container } = renderWithApp(<OdooSyncBar />, { user: finance });
    await waitFor(() => expect(asked).toBe(true));
    expect(container).toBeEmptyDOMElement();
  });

  it("says when the catalogue was last brought up to date and syncs on request", async () => {
    let posts = 0;
    server.use(
      http.get("/api/odoo/sync", () => HttpResponse.json(status())),
      http.post("/api/odoo/sync", () => {
        posts += 1;
        return HttpResponse.json({ ...run, byUser: true, summary: { imported: 1130, created: 3, updated: 5, repriced: 2, switchedOff: 1, warnings: 0 } });
      }),
    );
    const { user } = renderWithApp(
      <>
        <OdooSyncBar />
        <Toaster />
      </>,
      { user: finance },
    );
    expect(await screen.findByText(/Products come from Odoo/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sync now" }));
    expect(await screen.findByText("Synced: 3 new, 5 updated, 1 hidden.")).toBeInTheDocument();
    expect(posts).toBe(1);
  });

  it("warns when the last sync failed", async () => {
    server.use(http.get("/api/odoo/sync", () => HttpResponse.json(status({ last: { ...run, ok: false, error: "Odoo rejected the login.", summary: null } }))));
    renderWithApp(<OdooSyncBar />, { user: finance });
    expect(await screen.findByRole("alert")).toHaveTextContent("The last sync with Odoo failed: Odoo rejected the login.");
  });

  it("offers the button only to those who manage prices", async () => {
    server.use(http.get("/api/odoo/sync", () => HttpResponse.json(status())));
    renderWithApp(<OdooSyncBar />, { user: manager });
    expect(await screen.findByText(/Products come from Odoo/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();
  });
});
