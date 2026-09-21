import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./msw";

// ---- Next.js navigation (the app uses next-intl's locale-aware wrappers) ----
export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
let pathname = "/dashboard";
export function setPathname(p: string) {
  pathname = p;
}

vi.mock("@/i18n/navigation", async () => {
  const React = await import("react");
  return {
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children),
    useRouter: () => router,
    usePathname: () => pathname,
    redirect: vi.fn(),
    getPathname: ({ href }: { href: string }) => href,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => `/en${pathname}`,
  useSearchParams: () => new URLSearchParams(window.location.search),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

// ---- browser APIs jsdom lacks (Radix, dnd-kit, clipboard) ----
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;
Element.prototype.scrollIntoView ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;
// input-otp probes for password-manager badges with elementFromPoint, which jsdom lacks
document.elementFromPoint ??= () => null;
window.scrollTo = () => undefined;
Element.prototype.releasePointerCapture ??= () => undefined;
if (!navigator.clipboard) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
}
URL.createObjectURL ??= () => "blob:preview";
URL.revokeObjectURL ??= () => undefined;

// ---- network: MSW, plus relative "/api" URLs resolved like in the browser ----
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  const intercepted = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    intercepted(typeof input === "string" && input.startsWith("/") ? new URL(input, window.location.origin) : input, init)) as typeof fetch;
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
});
afterAll(() => server.close());
