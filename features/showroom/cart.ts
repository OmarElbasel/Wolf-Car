import { ORDER_MAX_LINES, ORDER_MAX_QUANTITY } from "@/shared/validation";

/**
 * Showroom cart as a pure reducer. Quantities are capped at the same limits
 * the API enforces (99 per line, 50 lines), and totals are summed in integer
 * dirhams so 3 × 145.50 + 0.10 is exactly "436.60".
 */
export interface CartLine {
  productId: string;
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
}

export type CartAction =
  | { type: "add"; productId: string }
  | { type: "increment"; productId: string }
  | { type: "decrement"; productId: string }
  | { type: "remove"; productId: string }
  | { type: "clear" }
  | { type: "prune"; validIds: Iterable<string> };

export const EMPTY_CART: CartState = { lines: [] };

function setQuantity(state: CartState, productId: string, quantity: number): CartState {
  const current = state.lines.find((l) => l.productId === productId);
  if (!current) return state;
  if (quantity <= 0) return { lines: state.lines.filter((l) => l.productId !== productId) };
  const next = Math.min(quantity, ORDER_MAX_QUANTITY);
  if (next === current.quantity) return state;
  return { lines: state.lines.map((l) => (l.productId === productId ? { ...l, quantity: next } : l)) };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const current = state.lines.find((l) => l.productId === action.productId);
      if (current) return setQuantity(state, action.productId, current.quantity + 1);
      if (state.lines.length >= ORDER_MAX_LINES) return state;
      return { lines: [...state.lines, { productId: action.productId, quantity: 1 }] };
    }
    case "increment": {
      const current = state.lines.find((l) => l.productId === action.productId);
      return current ? setQuantity(state, action.productId, current.quantity + 1) : state;
    }
    case "decrement": {
      const current = state.lines.find((l) => l.productId === action.productId);
      return current ? setQuantity(state, action.productId, current.quantity - 1) : state;
    }
    case "remove":
      return setQuantity(state, action.productId, 0);
    case "clear":
      return state.lines.length ? EMPTY_CART : state;
    case "prune": {
      const valid = new Set(action.validIds);
      const lines = state.lines.filter((l) => valid.has(l.productId));
      return lines.length === state.lines.length ? state : { lines };
    }
  }
}

export function itemCount(state: CartState): number {
  return state.lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function quantityOf(state: CartState, productId: string): number {
  return state.lines.find((l) => l.productId === productId)?.quantity ?? 0;
}

/** Whether one more of this product fits (per-line cap, and the line cap for new products). */
export function canAdd(state: CartState, productId: string): boolean {
  const quantity = quantityOf(state, productId);
  return quantity > 0 ? quantity < ORDER_MAX_QUANTITY : state.lines.length < ORDER_MAX_LINES;
}

/** "125.50" → 12550 (integer dirhams). Unknown or malformed prices count as 0. */
export function toDirhams(price: string | number | null | undefined): number {
  const value = Number(price);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function formatDirhams(dirhams: number): string {
  const sign = dirhams < 0 ? "-" : "";
  const abs = Math.abs(dirhams);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Line total as a "123.45" string. */
export function lineTotal(price: string | number | null | undefined, quantity: number): string {
  return formatDirhams(toDirhams(price) * quantity);
}

/** Cart total as a "123.45" string; lines whose product has no known price are ignored. */
export function total(state: CartState, prices: ReadonlyMap<string, string> | Readonly<Record<string, string>>): string {
  const priceOf = (id: string) => (prices instanceof Map ? prices.get(id) : (prices as Record<string, string>)[id]);
  const sum = state.lines.reduce((acc, l) => {
    const price = priceOf(l.productId);
    return price === undefined ? acc : acc + toDirhams(price) * l.quantity;
  }, 0);
  return formatDirhams(sum);
}
