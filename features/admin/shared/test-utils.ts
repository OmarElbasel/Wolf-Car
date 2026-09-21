import { vi } from "vitest";

/**
 * Per-test browser state for the admin pages:
 * - the URL (filters are mirrored in the query string),
 * - the layout: `wide` renders the desktop tables instead of the phone cards,
 * - jsdom focus: when a focused element is removed (a closed dialog), jsdom
 *   remembers the Document as focused and fires "blur" on window at the next
 *   focus change, which closes Radix menus. A real browser doesn't.
 */
export function resetAdminTestState(path: string, { wide = true }: { wide?: boolean } = {}) {
  window.history.replaceState(null, "", path);
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList,
  );
  const probe = document.createElement("button");
  document.body.append(probe);
  probe.focus();
  probe.blur();
  probe.remove();
}
