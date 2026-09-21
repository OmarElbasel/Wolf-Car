"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Filter state mirrored in the query string (shareable, survives reloads).
 * The URL is read once on mount and then written with history.replaceState,
 * which Next.js integrates with its router without refetching the page.
 * Empty values are left out of the URL.
 */
export function useUrlState<K extends string>(keys: readonly K[]): [Record<K, string>, (patch: Partial<Record<K, string>>) => void] {
  const params = useSearchParams();
  const [state, setState] = useState(() => pick(keys, params));

  const update = (patch: Partial<Record<K, string>>) => {
    // the URL is always in step with the state, so merging into it (not into a
    // possibly stale closure) keeps debounced updates from undoing newer ones
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(patch) as [K, string | undefined][]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setState(pick(keys, url.searchParams));
  };

  return [state, update];
}

function pick<K extends string>(keys: readonly K[], params: { get(key: string): string | null }): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;
}

/** `value`, once it stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Calls `fn` once the calls stopped for `delay` ms (search boxes). */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay = 300): (...args: A) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (...args: A) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  };
}
