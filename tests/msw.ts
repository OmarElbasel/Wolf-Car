import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/**
 * Shared MSW server; tests add handlers with server.use(http.get("/api/...", ...)).
 * The one default: Odoo is not connected, so pages that show its sync status
 * stay as they were unless a test says otherwise.
 */
export const server = setupServer(
  http.get("/api/odoo/sync", () => HttpResponse.json({ configured: false, running: false, everyMinutes: 15, last: null, lastOk: null })),
);
