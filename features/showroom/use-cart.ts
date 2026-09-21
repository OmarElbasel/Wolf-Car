"use client";

import { useEffect, useMemo, useReducer } from "react";
import { ORDER_MAX_LINES, ORDER_MAX_QUANTITY } from "@/shared/validation";
import { type CartLine, cartReducer, type CartState, EMPTY_CART } from "./cart";

/**
 * Kept in sessionStorage so switching the kiosk language (a full remount) does
 * not lose the customer's cart. Cleared by idle reset, checkout and locking.
 */
const STORAGE_KEY = "wolfcar.showroom.cart";

function readStoredCart(): CartState {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(parsed)) return EMPTY_CART;
    const seen = new Set<string>();
    const lines: CartLine[] = [];
    for (const item of parsed as Partial<CartLine>[]) {
      const { productId, quantity } = item ?? {};
      if (typeof productId !== "string" || seen.has(productId) || !Number.isInteger(quantity)) continue;
      if ((quantity as number) < 1 || lines.length >= ORDER_MAX_LINES) continue;
      seen.add(productId);
      lines.push({ productId, quantity: Math.min(quantity as number, ORDER_MAX_QUANTITY) });
    }
    return lines.length ? { lines } : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

export function clearStoredCart(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode): nothing to clear
  }
}

/** The kiosk cart: reducer state plus stable action helpers. */
export function useCart({ persist = false }: { persist?: boolean } = {}) {
  const [state, dispatch] = useReducer(cartReducer, undefined, () => (persist ? readStoredCart() : EMPTY_CART));

  useEffect(() => {
    if (!persist) return;
    try {
      if (state.lines.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage full or unavailable: the cart still works in memory
    }
  }, [persist, state]);

  const actions = useMemo(
    () => ({
      add: (productId: string) => dispatch({ type: "add", productId }),
      increment: (productId: string) => dispatch({ type: "increment", productId }),
      decrement: (productId: string) => dispatch({ type: "decrement", productId }),
      remove: (productId: string) => dispatch({ type: "remove", productId }),
      clear: () => dispatch({ type: "clear" }),
      prune: (validIds: Iterable<string>) => dispatch({ type: "prune", validIds }),
    }),
    [],
  );
  return { cart: state, ...actions };
}

export type CartApi = ReturnType<typeof useCart>;
