import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("strips accents", () => {
    expect(slugify("Café Cumbia", 50)).toBe("cafe-cumbia");
  });

  it("turns punctuation runs into one dash", () => {
    expect(slugify("  Gold, silk & lace!  ", 50)).toBe("gold-silk-lace");
  });

  it("honors the requested maximum length", () => {
    expect(slugify("abcdefghij", 6)).toBe("abcdef");
  });
});
