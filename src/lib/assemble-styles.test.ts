import { describe, expect, it } from "vitest";
import { styles } from "@/content";
import type { GarmentStyle } from "@/content/types";
import { assembleStyles, type StyleOverride } from "./live-catalog";

const style = (id: string, over: Partial<GarmentStyle> = {}): GarmentStyle =>
  ({
    id,
    slug: id,
    name: { en: id, es: id },
    categoryId: "dresses",
    priceEntryId: "dresses--daisy-cotton",
    color: { en: "", es: "" },
    description: { en: "", es: "" },
    detail: { en: "", es: "" },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [{ src: `/uploads/${id}.jpg`, alt: { en: "", es: "" }, isPrimary: true }],
    customizationAvailable: true,
    isPublished: true,
    ...over,
  }) as GarmentStyle;

const override = (over: Partial<StyleOverride>): StyleOverride => ({
  styleId: "a",
  isPublished: true,
  stock: {},
  updatedAt: "2026-08-28T00:00:00.000Z",
  ...over,
});

describe("assembling the catalog from seed and what Daysi added", () => {
  it("is just the seed when she has added nothing", () => {
    expect(assembleStyles([style("a")], [], []).map((s) => s.id)).toEqual(["a"]);
  });

  it("puts a garment she added ahead of the ones that shipped", () => {
    const result = assembleStyles([style("a")], [style("new")], []);
    expect(result.map((s) => s.id)).toEqual(["new", "a"]);
  });

  it("puts the garment she added last at the very front", () => {
    const result = assembleStyles([style("a")], [style("older"), style("newer")], []);
    expect(result.map((s) => s.id)).toEqual(["newer", "older", "a"]);
  });

  it("keeps a garment where it was when she edits it after adding another", () => {
    const result = assembleStyles(
      [style("a")],
      [style("older"), style("newer"), style("older", { name: { en: "edited", es: "editada" } })],
      [],
    );
    expect(result.map((s) => s.id)).toEqual(["newer", "older", "a"]);
    expect(result[1]?.name.en).toBe("edited");
  });

  it("leaves a shipped garment in its own place when she saves a new record of it", () => {
    const result = assembleStyles([style("a"), style("b")], [style("new"), style("a")], []);
    expect(result.map((s) => s.id)).toEqual(["new", "a", "b"]);
  });

  it("lets her unpublish a garment she added herself", () => {
    const result = assembleStyles([], [style("new")], [override({ styleId: "new", isPublished: false })]);
    expect(result.find((s) => s.id === "new")?.isPublished).toBe(false);
  });

  it("lets her take a size of her own garment off the rack", () => {
    const result = assembleStyles(
      [],
      [style("new")],
      [override({ styleId: "new", stock: { m: false } })],
    );
    const sizes = result.find((s) => s.id === "new")?.sizes ?? [];
    expect(sizes.find((s) => s.sizeId === "m")?.inStock).toBe(false);
    expect(sizes.find((s) => s.sizeId === "s")?.inStock).toBe(true);
  });

  it("keeps the newest record when she edits a garment twice", () => {
    const result = assembleStyles(
      [],
      [style("x", { name: { en: "first", es: "first" } }), style("x", { name: { en: "second", es: "second" } })],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.name.en).toBe("second");
  });

  it("still applies her overrides to the styles that shipped with the site", () => {
    const result = assembleStyles([style("a")], [], [override({ styleId: "a", isPublished: false })]);
    expect(result[0]?.isPublished).toBe(false);
  });

  it("drops a retired seeded garment", () => {
    expect(assembleStyles([style("a"), style("b")], [], [], new Set(["a"])).map((s) => s.id)).toEqual(["b"]);
  });

  it("drops a retired added garment", () => {
    expect(assembleStyles([], [style("new")], [], new Set(["new"]))).toEqual([]);
  });

  it("behaves unchanged with an empty retired set", () => {
    expect(assembleStyles([style("a")], [style("new")], [], new Set()).map((s) => s.id)).toEqual(["new", "a"]);
  });
});

describe("assembleStyles with text overrides", () => {
  it("applies a text override to a seeded garment", () => {
    const seed = styles.slice(0, 1);
    const merged = assembleStyles(seed, [], [], new Set(), [
      {
        subject: "style",
        id: seed[0]!.id,
        field: "description",
        locale: "es",
        value: "Palabras nuevas",
        updatedAt: "2026-09-03T00:00:00.000Z",
      },
    ]);
    expect(merged[0]!.description.es).toBe("Palabras nuevas");
    expect(merged[0]!.description.en).toBe(seed[0]!.description.en);
  });

  it("gives an office-added photo the corrected name in its alt text", () => {
    const seed = styles.slice(0, 1);
    const merged = assembleStyles(
      seed,
      [],
      [
        {
          styleId: seed[0]!.id,
          isPublished: true,
          stock: {},
          addedPhotos: ["/uploads/new.jpg"],
          updatedAt: "2026-09-03T00:00:00.000Z",
        },
      ],
      new Set(),
      [
        {
          subject: "style",
          id: seed[0]!.id,
          field: "name",
          locale: "es",
          value: "Nombre corregido",
          updatedAt: "2026-09-03T00:00:00.000Z",
        },
      ],
    );
    const added = merged[0]!.photos.find((photo) => photo.src === "/uploads/new.jpg");
    expect(added!.alt.es).toContain("Nombre corregido");
  });
});

describe("counted pieces per size", () => {
  const counted = "2026-09-20T12:00:00.000Z";
  const sizeOf = (result: GarmentStyle[], sizeId: string) =>
    result[0]?.sizes.find((size) => size.sizeId === sizeId);

  it("gives a counted size its number, and says it is ready while any are left", () => {
    const result = assembleStyles([style("a")], [], [override({ stock: { s: 2, m: 0 }, countedAt: { s: counted, m: counted } })]);
    expect(sizeOf(result, "s")).toEqual({ sizeId: "s", inStock: true, count: 2 });
    expect(sizeOf(result, "m")).toEqual({ sizeId: "m", inStock: false, count: 0 });
    expect(sizeOf(result, "l")).toEqual({ sizeId: "l", inStock: true });
  });

  it("takes off what has sold since she counted and what is held in a checkout", () => {
    const result = assembleStyles(
      [style("a")],
      [],
      [override({ stock: { s: 3 }, countedAt: { s: counted } })],
      new Set(),
      [],
      [
        { styleId: "a", sizeId: "s", quantity: 1, soldAt: "2026-09-20T13:00:00.000Z" },
        { styleId: "a", sizeId: "s", quantity: 1 },
        { styleId: "a", sizeId: "s", quantity: 1, soldAt: "2026-09-20T11:00:00.000Z" },
      ],
    );
    expect(sizeOf(result, "s")).toEqual({ sizeId: "s", inStock: true, count: 1 });
  });

  it("says a size is not ready once the last piece has gone", () => {
    const result = assembleStyles(
      [style("a")],
      [],
      [override({ stock: { s: 1 }, countedAt: { s: counted } })],
      new Set(),
      [],
      [{ styleId: "a", sizeId: "s", quantity: 1, soldAt: "2026-09-20T13:00:00.000Z" }],
    );
    expect(sizeOf(result, "s")).toEqual({ sizeId: "s", inStock: false, count: 0 });
  });

  it("leaves a size switched on or off, as before counting, without a number", () => {
    const result = assembleStyles([style("a")], [], [override({ stock: { s: false } })]);
    expect(sizeOf(result, "s")).toEqual({ sizeId: "s", inStock: false });
  });
});
