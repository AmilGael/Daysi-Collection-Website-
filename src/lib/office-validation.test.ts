import { describe, expect, it } from "vitest";
import { styleCreateSchema, styleOverrideSchema } from "./office-validation";

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
