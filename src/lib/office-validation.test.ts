import { describe, expect, it } from "vitest";
import {
  UNDO_KINDS,
  changesOf,
  collectionChangeSchema,
  fabricChangeSchema,
  galleryChangeSchema,
  priceChangeSchema,
  shopfrontChangeSchema,
  styleCreateSchema,
  styleOverrideSchema,
  undoQuerySchema,
  workChangeSchema,
} from "./office-validation";

const override = {
  isPublished: false,
  stock: { s: true, m: true, l: false },
};

describe("what the office accepts for a style override", () => {
  it("accepts a garment Daysi added herself, which carries a generated id", () => {
    // Regression: the id used to be an enum of the coded styles, so she could
    // add a garment and then never take it off the rack.
    const result = styleOverrideSchema.safeParse({ styleId: "sty-nm9pfhxu", ...override });
    expect(result.success).toBe(true);
  });

  it("still accepts a garment that shipped with the site", () => {
    expect(styleOverrideSchema.safeParse({ styleId: "frutera", ...override }).success).toBe(true);
  });

  it("refuses an empty id", () => {
    expect(styleOverrideSchema.safeParse({ styleId: "", ...override }).success).toBe(false);
  });

  it("refuses a photo path outside the uploads folder", () => {
    const result = styleOverrideSchema.safeParse({
      styleId: "frutera",
      ...override,
      addedPhotos: ["/etc/passwd"],
    });
    expect(result.success).toBe(false);
  });
});

describe("what the office accepts for a new garment", () => {
  const draft = {
    name: "Cumbia maxi",
    description: "A gathered-waist maxi in a golden print.",
    categoryId: "dresses",
    fabricId: "medallon-print",
    sizes: { s: true, m: true, l: false },
    photos: ["/uploads/img-abc123.jpg"],
  };

  it("accepts a garment with a name, a cloth, a size and a photograph", () => {
    expect(styleCreateSchema.safeParse(draft).success).toBe(true);
  });

  it("refuses one with no photograph at all", () => {
    expect(styleCreateSchema.safeParse({ ...draft, photos: [] }).success).toBe(false);
  });

  it("refuses a garment filed under a category that does not exist", () => {
    expect(styleCreateSchema.safeParse({ ...draft, categoryId: "hats" }).success).toBe(false);
  });

  it("refuses a price nobody could have meant", () => {
    expect(styleCreateSchema.safeParse({ ...draft, fixedPrice: 900_000_00 }).success).toBe(false);
  });
});

const styleOverrideChange = {
  type: "style-override",
  key: "style:frutera",
  styleId: "frutera",
  ...override,
};
const styleCreateChange = {
  type: "style-create",
  key: "style-create:one",
  name: "Cumbia maxi",
  description: "A gathered-waist maxi in a golden print.",
  categoryId: "dresses",
  fabricId: "medallon-print",
  sizes: { s: true, m: true, l: false },
  photos: ["/uploads/img-abc123.jpg"],
};
const workAdd = {
  type: "work-add",
  key: "work-add:one",
  src: "/uploads/gallery-one.webp",
  width: 1200,
  height: 1600,
  category: "runway",
  caption: "Golden dress",
};
const fabricAdd = {
  type: "fabric-add",
  key: "fabric-add:one",
  name: "Golden cotton",
  swatchImage: "/uploads/swatch-one.png",
  averageColor: "#aabbcc",
  prices: { dresses: 12000 },
};

describe.each([
  ["collection style override", collectionChangeSchema, styleOverrideChange],
  ["collection style create", collectionChangeSchema, styleCreateChange],
  ["collection retire", collectionChangeSchema, { type: "retire", key: "style:x", id: "x" }],
  ["collection restore", collectionChangeSchema, { type: "restore", key: "style:x", id: "x" }],
  ["gallery work add", galleryChangeSchema, workAdd],
  ["gallery visibility", galleryChangeSchema, { type: "work-visibility", key: "gallery:x", id: "x", hidden: true }],
  ["gallery retire", galleryChangeSchema, { type: "retire", key: "gallery:x", id: "x" }],
  ["gallery restore", galleryChangeSchema, { type: "restore", key: "gallery:x", id: "x" }],
  ["fabric add", fabricChangeSchema, fabricAdd],
  ["fabric retire", fabricChangeSchema, { type: "retire", key: "fabric:x", id: "x" }],
  ["fabric restore", fabricChangeSchema, { type: "restore", key: "fabric:x", id: "x" }],
  ["price entry", priceChangeSchema, { type: "entry", key: "entry:x", id: "x", fixedPrice: 100, customizationExtra: 0 }],
  ["price alteration", priceChangeSchema, { type: "alteration", key: "alteration:x", id: "x", fixedPrice: 100, rushSurcharge: 0 }],
  ["price appointment", priceChangeSchema, { type: "appointment", key: "appointment:x", id: "x", fee: 100 }],
  ["price retire", priceChangeSchema, { type: "retire", key: "entry:x", id: "x" }],
  ["price restore", priceChangeSchema, { type: "restore", key: "entry:x", id: "x" }],
  ["shopfront notice", shopfrontChangeSchema, { type: "notice", key: "notice:site", message: "Open", visible: true }],
  ["work request status", workChangeSchema, { type: "request-status", key: "request:ALT-1", kind: "alteration", reference: "ALT-1", status: "answered" }],
  ["work retire", workChangeSchema, { type: "retire", key: "request:CIT-1", id: "CIT-1" }],
  ["work restore", workChangeSchema, { type: "restore", key: "request:CIT-1", id: "CIT-1" }],
] as const)("%s change", (_name, schema, valid) => {
  it("accepts its member", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("refuses an invalid member", () => {
    expect(schema.safeParse({ ...valid, key: "missing-colon" }).success).toBe(false);
  });
});

describe("undo query", () => {
  it("accepts a named stream and non-empty id", () => {
    expect([...UNDO_KINDS]).toEqual(["style-override", "work-visibility", "price-entry", "alteration", "appointment", "notice", "request-status"]);
    expect(undoQuerySchema.safeParse({ kind: "notice", id: "site" }).success).toBe(true);
    expect(undoQuerySchema.safeParse({ kind: "retired:style", id: "x" }).success).toBe(false);
  });

  it("refuses an unknown stream and an empty id", () => {
    expect(undoQuerySchema.safeParse({ kind: "everything", id: "site" }).success).toBe(false);
    expect(undoQuerySchema.safeParse({ kind: "notice", id: "" }).success).toBe(false);
  });
});

describe("change batch boundaries", () => {
  const batch = changesOf(collectionChangeSchema);

  it("refuses an empty batch and a batch of 51", () => {
    expect(batch.safeParse([]).success).toBe(false);
    expect(batch.safeParse(Array.from({ length: 51 }, () => styleOverrideChange)).success).toBe(false);
  });

  it("refuses an unknown type and a key without a colon", () => {
    expect(collectionChangeSchema.safeParse({ ...styleOverrideChange, type: "publish" }).success).toBe(false);
    expect(collectionChangeSchema.safeParse({ ...styleOverrideChange, key: "style" }).success).toBe(false);
  });

  it("enforces member-specific numeric and enum limits", () => {
    expect(galleryChangeSchema.safeParse({ ...workAdd, width: 0 }).success).toBe(false);
    expect(fabricChangeSchema.safeParse({ ...fabricAdd, prices: {} }).success).toBe(false);
    expect(fabricChangeSchema.safeParse({ ...fabricAdd, prices: { dresses: 99 } }).success).toBe(false);
    expect(priceChangeSchema.safeParse({ type: "entry", key: "entry:x", id: "x", fixedPrice: 5_000_01, customizationExtra: 0 }).success).toBe(false);
    expect(workChangeSchema.safeParse({ type: "request-status", key: "request:x", kind: "order", reference: "x", status: "done" }).success).toBe(false);
  });
});

describe("office price boundaries", () => {
  const entry = { type: "entry", key: "entry:x", id: "x", customizationExtra: 0 };

  it("accepts a price of exactly 5000 dollars", () => {
    expect(priceChangeSchema.safeParse({ ...entry, fixedPrice: 500_000 }).success).toBe(true);
  });

  it("refuses a price one cent above 5000 dollars", () => {
    expect(priceChangeSchema.safeParse({ ...entry, fixedPrice: 500_001 }).success).toBe(false);
  });
});
