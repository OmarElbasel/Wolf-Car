import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";
import { cart, cartTotals, orderMessage, useCart, type CartLine } from "./cart";

const line = (over: Partial<CartLine>): CartLine => ({ id: "x", name: "Part", price: "10.00", thumbUrl: "/t.webp", qty: 1, ...over });

afterEach(() => act(() => cart.clear()));

describe("cart store", () => {
  it("adds, increments, changes and removes lines, and remembers them", () => {
    const { result } = renderHook(() => useCart());
    const mats = { id: "m", name: "Mats", price: "120.50", thumbUrl: "/m.webp" };
    act(() => cart.add(mats));
    act(() => cart.add(mats));
    expect(result.current).toEqual([{ ...mats, qty: 2 }]);
    expect(JSON.parse(localStorage.getItem("wolfcar.cart.v1")!)).toEqual([{ ...mats, qty: 2 }]);
    act(() => cart.setQty("m", 150));
    expect(result.current[0].qty).toBe(99);
    act(() => cart.setQty("m", 0));
    expect(result.current).toEqual([]);
  });
});

describe("cartTotals", () => {
  it("sums priced lines and counts the unpriced ones", () => {
    expect(cartTotals([line({ price: "120.50", qty: 2 }), line({ id: "y", price: null, qty: 3 })])).toEqual({
      total: 241,
      count: 5,
      unpriced: 1,
    });
  });
});

describe("orderMessage", () => {
  it("lists every line with quantity and line total, then the total", () => {
    const text = orderMessage([line({ name: "Mats", price: "120.50", qty: 2 }), line({ id: "y", name: "Holder", price: null })], "en");
    expect(text).toBe(
      [
        "I'd like to order these products from the Bin Omran branch:",
        `1. Mats × 2 — ${formatMoney(241, "en")}`,
        "2. Holder × 1 — price on request",
        `Total: ${formatMoney(241, "en")} (excluding items without a price)`,
      ].join("\n"),
    );
  });

  it("is written in Arabic for the Arabic site", () => {
    const text = orderMessage([line({ name: "مصباح", price: "6000", qty: 1 })], "ar");
    expect(text.split("\n")[0]).toBe("أرغب في طلب المنتجات التالية من فرع بن عمران:");
    expect(text).toContain("1. مصباح × 1 — ");
    expect(text).not.toContain("غير المسعّرة");
  });
});
