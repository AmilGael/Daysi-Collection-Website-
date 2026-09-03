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

  it("puts a garment she added after the ones that shipped", () => {
    const result = assembleStyles([style("a")], [style("new")], []);
    expect(result.map((s) => s.id)).toEqual(["a", "new"]);
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
    expect(assembleStyles([style("a")], [style("new")], [], new Set()).map((s) => s.id)).toEqual(["a", "new"]);
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
