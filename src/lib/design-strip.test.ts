import { describe, expect, it } from "vitest";
import type { GalleryWork, GarmentStyle } from "@/content/types";
import { stripPhotos } from "./design-strip";

const garment = (id: string, src: string, alt = { en: `${id} alt`, es: `${id} alt es` }): GarmentStyle =>
  ({
    id,
    slug: id,
    name: { en: `${id} name`, es: `${id} nombre` },
    categoryId: "dresses",
    priceEntryId: "dresses--daisy-cotton",
    color: { en: "", es: "" },
    description: { en: "", es: "" },
    detail: { en: "", es: "" },
    sizes: [],
    photos: [{ src, alt, isPrimary: true }],
    customizationAvailable: true,
    isPublished: true,
  }) as GarmentStyle;

const work = (id: string, src: string): GalleryWork => ({
  id,
  src,
  width: 1200,
  height: 800,
  category: "commissions",
  caption: { en: `${id} caption`, es: `${id} leyenda` },
});

describe("the photographs along the homepage strip", () => {
  it("leads with the garment she put up last, then alternates with finished work", () => {
    const photos = stripPhotos(
      [garment("newest", "/uploads/newest.jpg"), garment("older", "/images/real/older.jpg")],
      [work("w1", "/images/gallery/w1.jpg"), work("w2", "/images/gallery/w2.jpg")],
      12,
    );
    expect(photos.map((photo) => photo.src)).toEqual([
      "/uploads/newest.jpg",
      "/images/gallery/w1.jpg",
      "/images/real/older.jpg",
      "/images/gallery/w2.jpg",
    ]);
  });

  it("sends a garment to its own page and a finished piece to the gallery", () => {
    const [first, second] = stripPhotos([garment("sol", "/uploads/sol.jpg")], [work("w1", "/images/gallery/w1.jpg")], 12);
    expect(first?.href).toBe("/collection/sol");
    expect(second?.href).toBe("/gallery");
  });

  it("stops at the number asked for", () => {
    const garments = Array.from({ length: 10 }, (_, index) => garment(`g${index}`, `/uploads/g${index}.jpg`));
    const works = Array.from({ length: 10 }, (_, index) => work(`w${index}`, `/images/gallery/w${index}.jpg`));
    expect(stripPhotos(garments, works, 12)).toHaveLength(12);
  });

  it("shows a photograph once even when a garment and a gallery piece share it", () => {
    const photos = stripPhotos([garment("sol", "/images/real/sol.jpg")], [work("w1", "/images/real/sol.jpg")], 12);
    expect(photos.map((photo) => photo.src)).toEqual(["/images/real/sol.jpg"]);
  });

  it("only shows photographs from Daysi's own folders", () => {
    const photos = stripPhotos(
      [garment("drawn", "/images/texture/hero-weave.jpg"), garment("real", "/images/real/real.jpg")],
      [work("elsewhere", "https://example.com/w.jpg")],
      12,
    );
    expect(photos.map((photo) => photo.src)).toEqual(["/images/real/real.jpg"]);
  });

  it("describes every photograph in both languages, falling back to the garment's name", () => {
    const photos = stripPhotos(
      [garment("sol", "/uploads/sol.jpg", { en: "", es: "" })],
      [work("w1", "/images/gallery/w1.jpg")],
      12,
    );
    expect(photos[0]?.alt).toEqual({ en: "sol name", es: "sol nombre" });
    expect(photos[1]?.alt).toEqual({ en: "w1 caption", es: "w1 leyenda" });
  });

  it("keeps a gallery piece's own proportions and gives a garment the collection's", () => {
    const photos = stripPhotos([garment("sol", "/uploads/sol.jpg")], [work("w1", "/images/gallery/w1.jpg")], 12);
    expect(photos[0]?.aspect).toBe(3 / 4);
    expect(photos[1]?.aspect).toBe(1200 / 800);
  });
});
