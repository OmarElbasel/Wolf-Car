import { describe, expect, it } from "vitest";
import { groupVariants } from "./variants";

const item = (id: string, name: string, groupId: string | null = null, variantLabel: string | null = null) => ({ id, name, groupId, variantLabel });

describe("groupVariants", () => {
  it("folds the colours of one product into one entry, named without the colour", () => {
    const groups = groupVariants([item("a", "Arm rest (Black)", "7", "Black"), item("b", "Dash cam"), item("c", "Arm rest (Beige)", "7", "Beige")]);
    expect(groups.map((g) => [g.title, g.variants.map((v) => v.id)])).toEqual([
      ["Arm rest", ["a", "c"]],
      ["Dash cam", ["b"]],
    ]);
  });

  it("keeps the full name of a product left with a single colour", () => {
    expect(groupVariants([item("a", "Arm rest (Black)", "7", "Black")])[0].title).toBe("Arm rest (Black)");
  });

  it("does not merge products that merely lack a group", () => {
    expect(groupVariants([item("a", "Mat"), item("b", "Mat")])).toHaveLength(2);
  });

  it("copes with products from an API that does not send variant fields yet", () => {
    expect(groupVariants([{ id: "a", name: "Mat" }])).toEqual([{ key: "p:a", title: "Mat", variants: [{ id: "a", name: "Mat" }] }]);
  });
});
