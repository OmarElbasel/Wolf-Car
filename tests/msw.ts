import { setupServer } from "msw/node";

/** Shared MSW server; tests add handlers with server.use(http.get("/api/...", ...)). */
export const server = setupServer();
