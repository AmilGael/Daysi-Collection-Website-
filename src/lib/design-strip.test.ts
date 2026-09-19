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
  it("shows finished work from the gallery, never the garments for sale", () => {
    const photos = stripPhotos(
      [garment("newest", "/uploads/newest.jpg"), garment("older", "/images/real/older.jpg")],
      [work("w1", "/images/gallery/w1.jpg"), work("w2", "/images/gallery/w2.jpg")],
      12,
    );
    expect(photos.map((photo) => photo.src)).toEqual(["/images/gallery/w1.jpg", "/images/gallery/w2.jpg"]);
    expect(photos.every((photo) => photo.href === "/gallery")).toBe(true);
  });

  it("leaves out a gallery piece that is also a garment's photo", () => {
    const photos = stripPhotos(
      [garment("sirena", "/images/real/sirena.jpg")],
      [work("same", "/images/real/sirena.jpg"), work("own", "/images/gallery/own.jpg")],
      12,
    );
    expect(photos.map((photo) => photo.src)).toEqual(["/images/gallery/own.jpg"]);
  });

  it("stops at the number asked for", () => {
    const works = Array.from({ length: 20 }, (_, index) => work(`w${index}`, `/images/gallery/w${index}.jpg`));
    expect(stripPhotos([], works, 12)).toHaveLength(12);
  });

  it("only shows photographs from Daysi's own folders", () => {
    const photos = stripPhotos([], [work("gen", "/images/texture/hero-weave.jpg"), work("own", "/uploads/own.jpg")], 12);
    expect(photos.map((photo) => photo.src)).toEqual(["/uploads/own.jpg"]);
  });

  it("keeps a gallery piece's own proportions and its caption in both languages", () => {
    const [photo] = stripPhotos([], [work("w1", "/images/gallery/w1.jpg")], 12);
    expect(photo?.aspect).toBeCloseTo(1.5);
    expect(photo?.alt).toEqual({ en: "w1 caption", es: "w1 leyenda" });
  });
});
