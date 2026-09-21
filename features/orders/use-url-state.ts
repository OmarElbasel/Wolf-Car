"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { type OrdersUrlState, parseUrlState, serializeUrlState } from "./queries";

const CHANGE = "wolfcar:orders-url";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

const currentSearch = () => window.location.search.replace(/^\?/, "");

/**
 * The orders page's filters and open order, with the address bar as the
 * single source of truth. Updates use history.replaceState (no navigation,
 * no server round trip; Next.js keeps useSearchParams in sync) and re-render
 * at once; links from elsewhere (?status=PENDING, ?open=<id>) just work.
 */
export function useOrdersUrlState(): [OrdersUrlState, (patch: Partial<OrdersUrlState>) => void] {
  // re-renders on Next.js navigations; also the value used while prerendering
  const searchParams = useSearchParams();
  const search = useSyncExternalStore(subscribe, currentSearch, () => searchParams.toString());
  const state = useMemo(() => parseUrlState(new URLSearchParams(search)), [search]);

  const update = useCallback((patch: Partial<OrdersUrlState>) => {
    const next = serializeUrlState({ ...parseUrlState(new URLSearchParams(currentSearch())), ...patch });
    if (next === currentSearch()) return;
    window.history.replaceState(null, "", next ? `?${next}` : window.location.pathname);
    window.dispatchEvent(new Event(CHANGE));
  }, []);

  return [state, update];
}
