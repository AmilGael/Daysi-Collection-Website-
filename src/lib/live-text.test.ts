import { describe, expect, it } from "vitest";
import { applyGalleryText, applyStyleText, textKey, type TextOverride } from "./live-text";
import type { GalleryWork, GarmentStyle } from "@/content/types";

const style = {
  id: "s1",
  slug: "s1",
  name: { es: "Vestido", en: "Dress" },
  categoryId: "dresses",
  priceEntryId: "dresses--laguna",
  color: { es: "Azul", en: "Blue" },
  description: { es: "Descripción vieja", en: "Old description" },
  detail: { es: "Detalle viejo", en: "Old detail" },
  sizes: [{ sizeId: "m", inStock: true }],
  photos: [{ src: "/a.jpg", alt: { es: "a", en: "a" }, isPrimary: true }],
  customizationAvailable: true,
  isPublished: true,
} satisfies GarmentStyle;

const work = {
  id: "g1",
  src: "/g.jpg",
  width: 100,
  height: 100,
  category: "runway",
  caption: { es: "Pie viejo", en: "Old caption" },
} satisfies GalleryWork;

function override(patch: Partial<TextOverride>): TextOverride {
  return {
    subject: "style",
    id: "s1",
    field: "description",
    locale: "es",
    value: "Descripción nueva",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...patch,
  };
}

describe("applyStyleText", () => {
  it("leaves the catalog alone when there are no overrides", () => {
    expect(applyStyleText([style], [])).toEqual([style]);
  });

  it("replaces one field in one language and leaves the other language alone", () => {
    const [merged] = applyStyleText([style], [override({})]);
    expect(merged!.description.es).toBe("Descripción nueva");
    expect(merged!.description.en).toBe("Old description");
  });

  it("leaves the other fields alone", () => {
    const [merged] = applyStyleText([style], [override({})]);
    expect(merged!.name).toEqual(style.name);
    expect(merged!.detail).toEqual(style.detail);
  });

  it("treats an empty value as a return to the coded words", () => {
    const [merged] = applyStyleText([style], [override({ value: "" })]);
    expect(merged!.description.es).toBe("Descripción vieja");
  });

  it("ignores an override for a style that is not there", () => {
    expect(applyStyleText([style], [override({ id: "missing" })])).toEqual([style]);
  });

  it("ignores a gallery override when merging styles", () => {
    expect(applyStyleText([style], [override({ subject: "gallery" })])).toEqual([style]);
  });

  it("overrides the name in both languages when both are given", () => {
    const [merged] = applyStyleText([style], [
      override({ field: "name", locale: "es", value: "Falda" }),
      override({ field: "name", locale: "en", value: "Skirt" }),
    ]);
    expect(merged!.name).toEqual({ es: "Falda", en: "Skirt" });
  });
});

describe("applyGalleryText", () => {
  it("replaces a caption in one language", () => {
    const [merged] = applyGalleryText([work], [
      override({ subject: "gallery", id: "g1", field: "caption", locale: "es", value: "Pie nuevo" }),
    ]);
    expect(merged!.caption).toEqual({ es: "Pie nuevo", en: "Old caption" });
  });

  it("ignores a caption override aimed at a style", () => {
    expect(
      applyGalleryText([work], [override({ id: "g1", field: "caption", value: "x" })]),
    ).toEqual([work]);
  });
});

describe("textKey", () => {
  it("names the subject, the id, the field and the locale", () => {
    expect(textKey("style", "s1", "description", "es")).toBe("style:s1:description:es");
  });
});
