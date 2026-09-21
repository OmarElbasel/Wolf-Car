import { describe, expect, it } from "vitest";
import { ORDER_MAX_LINES, ORDER_MAX_QUANTITY } from "@/shared/validation";
import {
  type CartAction,
  cartReducer,
  type CartState,
  canAdd,
  EMPTY_CART,
  itemCount,
  lineTotal,
  quantityOf,
  total,
} from "./cart";

const run = (...actions: CartAction[]) => actions.reduce<CartState>(cartReducer, EMPTY_CART);
const add = (productId: string): CartAction => ({ type: "add", productId });

describe("cart reducer", () => {
  it("adds a new line, then bumps its quantity on repeated adds", () => {
    const state = run(add("a"), add("b"), add("a"));
    expect(state.lines).toEqual([
      { productId: "a", quantity: 2 },
      { productId: "b", quantity: 1 },
    ]);
    expect(itemCount(state)).toBe(3);
    expect(quantityOf(state, "a")).toBe(2);
    expect(quantityOf(state, "zzz")).toBe(0);
  });

  it("increments and decrements, removing the line at zero", () => {
    let state = run(add("a"), { type: "increment", productId: "a" });
    expect(quantityOf(state, "a")).toBe(2);
    state = cartReducer(state, { type: "decrement", productId: "a" });
    expect(quantityOf(state, "a")).toBe(1);
    state = cartReducer(state, { type: "decrement", productId: "a" });
    expect(state.lines).toEqual([]);
  });

  it("ignores increment/decrement/remove for products not in the cart", () => {
    const state = run(add("a"));
    expect(cartReducer(state, { type: "increment", productId: "x" })).toBe(state);
    expect(cartReducer(state, { type: "decrement", productId: "x" })).toBe(state);
    expect(cartReducer(state, { type: "remove", productId: "x" })).toBe(state);
  });

  it("removes a line and clears the cart", () => {
    const state = run(add("a"), add("b"), { type: "remove", productId: "a" });
    expect(state.lines).toEqual([{ productId: "b", quantity: 1 }]);
    expect(cartReducer(state, { type: "clear" })).toEqual(EMPTY_CART);
    expect(cartReducer(EMPTY_CART, { type: "clear" })).toBe(EMPTY_CART);
  });

  it("prunes lines whose product is no longer offered, keeping the state when nothing changes", () => {
    const state = run(add("a"), add("b"), add("c"));
    const pruned = cartReducer(state, { type: "prune", validIds: ["a", "c", "d"] });
    expect(pruned.lines.map((l) => l.productId)).toEqual(["a", "c"]);
    expect(cartReducer(pruned, { type: "prune", validIds: new Set(["a", "c"]) })).toBe(pruned);
  });

  it(`caps a line at ${ORDER_MAX_QUANTITY}`, () => {
    let state = run(add("a"));
    for (let i = 0; i < 150; i++) state = cartReducer(state, i % 2 ? add("a") : { type: "increment", productId: "a" });
    expect(quantityOf(state, "a")).toBe(ORDER_MAX_QUANTITY);
    expect(canAdd(state, "a")).toBe(false);
    expect(cartReducer(state, add("a"))).toBe(state);
  });

  it(`holds at most ${ORDER_MAX_LINES} lines`, () => {
    let state = EMPTY_CART;
    for (let i = 0; i < ORDER_MAX_LINES + 5; i++) state = cartReducer(state, add(`p${i}`));
    expect(state.lines).toHaveLength(ORDER_MAX_LINES);
    expect(canAdd(state, "another")).toBe(false);
    // products already in the cart can still grow
    expect(canAdd(state, "p0")).toBe(true);
    expect(quantityOf(cartReducer(state, add("p0")), "p0")).toBe(2);
  });
});

describe("cart totals", () => {
  it("sums in integer dirhams without float drift", () => {
    const state = run(add("a"), add("a"), add("a"), add("b"));
    expect(total(state, { a: "145.50", b: "0.10" })).toBe("436.60");
    // 0.1 + 0.2 style drift
    const drift = run(add("x"), add("y"));
    expect(total(drift, new Map([["x", "0.10"], ["y", "0.20"]]))).toBe("0.30");
  });

  it("formats whole amounts and large totals with two decimals", () => {
    const state = run(add("a"), { type: "increment", productId: "a" });
    expect(total(state, { a: "1250" })).toBe("2500.00");
    expect(lineTotal("9999999.99", 99)).toBe("989999999.01");
    expect(lineTotal("19.99", 3)).toBe("59.97");
  });

  it("ignores lines without a known price and returns 0.00 for an empty cart", () => {
    expect(total(run(add("a"), add("ghost")), { a: "12.25" })).toBe("12.25");
    expect(total(EMPTY_CART, {})).toBe("0.00");
  });
});
