import { describe, expect, it } from "vitest";
import { styles } from "@/content";
import { applyOverrides, type StyleOverride } from "./live-catalog";

const override = (over: Partial<StyleOverride>): StyleOverride => ({
  styleId: "frutera",
  isPublished: true,
  stock: {},
  updatedAt: "2026-08-18T12:00:00.000Z",
  ...over,
});

describe("the live catalog merge", () => {
  it("changes nothing when there are no overrides", () => {
    expect(applyOverrides(styles, [])).toEqual([...styles]);
  });

  it("hides a style Daysi has unpublished", () => {
    const merged = applyOverrides(styles, [override({ isPublished: false })]);
    expect(merged.find((style) => style.id === "frutera")?.isPublished).toBe(false);
    // Only the named style is touched.
    expect(merged.filter((style) => style.isPublished)).toHaveLength(styles.length - 1);
  });

  it("marks a single size out of stock and leaves the others alone", () => {
    const merged = applyOverrides(styles, [override({ stock: { m: false } })]);
    const sizes = merged.find((style) => style.id === "frutera")?.sizes ?? [];
    expect(sizes.find((size) => size.sizeId === "m")?.inStock).toBe(false);
    expect(sizes.find((size) => size.sizeId === "s")?.inStock).toBe(true);
  });

  it("says nothing about sizes an override does not name", () => {
    const merged = applyOverrides(styles, [override({ stock: {} })]);
    expect(merged.find((style) => style.id === "frutera")?.sizes).toEqual(
      styles.find((style) => style.id === "frutera")?.sizes,
    );
  });

  it("restores stock when a later override turns it back on", () => {
    const merged = applyOverrides(styles, [override({ stock: { m: true } })]);
    expect(
      merged.find((style) => style.id === "frutera")?.sizes.find((s) => s.sizeId === "m")
        ?.inStock,
    ).toBe(true);
  });
});
