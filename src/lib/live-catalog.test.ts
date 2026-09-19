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

describe("the photo list on an override", () => {
  const frutera = () => styles.find((style) => style.id === "frutera")!;
  const coded = () => frutera().photos.map((photo) => photo.src);

  it("shows the photos the record lists, in that order, the first as the cover", () => {
    const [first, second] = coded();
    const merged = applyOverrides(styles, [override({ photos: [second!, first!] })]);
    const photos = merged.find((style) => style.id === "frutera")!.photos;
    expect(photos.map((photo) => photo.src)).toEqual([second, first]);
    expect(photos.map((photo) => photo.isPrimary)).toEqual([true, false]);
    // A coded photo keeps its own alt text.
    expect(photos[0]!.alt).toEqual(frutera().photos[1]!.alt);
  });

  it("hides a coded photo the list leaves out, and gives an upload the atelier alt", () => {
    const [first] = coded();
    const merged = applyOverrides(styles, [
      override({ photos: ["/uploads/img-abc12345.jpg", first!] }),
    ]);
    const photos = merged.find((style) => style.id === "frutera")!.photos;
    expect(photos.map((photo) => photo.src)).toEqual(["/uploads/img-abc12345.jpg", first]);
    expect(photos[0]!.alt.es).toContain("fotografiado en el taller");
    expect(photos[0]!.isPrimary).toBe(true);
  });

  it("drops a photo the garment does not own, and keeps the coded photos when nothing is left", () => {
    const [first] = coded();
    const withStranger = applyOverrides(styles, [override({ photos: ["/images/real/other.jpg", first!] })]);
    expect(withStranger.find((style) => style.id === "frutera")!.photos.map((photo) => photo.src)).toEqual([first]);
    const nothingLeft = applyOverrides(styles, [override({ photos: ["/images/real/other.jpg"] })]);
    expect(nothingLeft.find((style) => style.id === "frutera")!.photos).toEqual(frutera().photos);
  });

  it("reads a record without a photo list exactly as before: added after coded, cover by src", () => {
    const merged = applyOverrides(styles, [
      override({ addedPhotos: ["/uploads/img-abc12345.jpg"], coverSrc: "/uploads/img-abc12345.jpg" }),
    ]);
    const photos = merged.find((style) => style.id === "frutera")!.photos;
    expect(photos[0]!.src).toBe("/uploads/img-abc12345.jpg");
    expect(photos[0]!.isPrimary).toBe(true);
    expect(photos).toHaveLength(coded().length + 1);
  });
});

describe("offered in the studio", () => {
  it("is off for a coded garment and follows the record when it says so", () => {
    expect(applyOverrides(styles, []).find((style) => style.id === "frutera")!.inStudio).toBeUndefined();
    const on = applyOverrides(styles, [override({ inStudio: true })]);
    expect(on.find((style) => style.id === "frutera")!.inStudio).toBe(true);
    const silent = applyOverrides(styles, [override({ stock: { m: false } })]);
    expect(silent.find((style) => style.id === "frutera")!.inStudio).toBeUndefined();
  });
});

describe("a garment's own price", () => {
  it("carries an own price from the override onto the style, and a later override without one clears it", () => {
    expect(applyOverrides(styles, []).find((style) => style.id === "frutera")!.ownPrice).toBeUndefined();

    const own = applyOverrides(styles, [override({ fixedPrice: 27000, customizationExtra: 8000 })]);
    expect(own.find((style) => style.id === "frutera")!.ownPrice).toEqual({ fixedPrice: 27000, customizationExtra: 8000 });

    const priceOnly = applyOverrides(styles, [override({ fixedPrice: 27000 })]);
    expect(priceOnly.find((style) => style.id === "frutera")!.ownPrice).toEqual({ fixedPrice: 27000 });

    // The newest record is the whole truth: one without a price is the list price again.
    const cleared = applyOverrides(styles, [override({ stock: { m: false } })]);
    expect(cleared.find((style) => style.id === "frutera")!.ownPrice).toBeUndefined();
  });

  it("reads an extra only beside a price", () => {
    const extraAlone = applyOverrides(styles, [override({ customizationExtra: 8000 })]);
    expect(extraAlone.find((style) => style.id === "frutera")!.ownPrice).toBeUndefined();
  });
});
