import { describe, expect, it } from "vitest";
import { fabrics, categories } from "./catalog";
import { priceList } from "./price-list";
import { styles } from "./styles";

/**
 * The catalog's honesty rules. Every cloth on offer is one Daysi actually has
 * and has photographed — a swatch nobody can produce is a promise the atelier
 * cannot keep, and a generated one is worse than none.
 */

describe("the fabric list", () => {
  it("offers no cloth that is not a real photograph", () => {
    const unphotographed = fabrics
      .filter((fabric) => !fabric.swatchImage.startsWith("/images/real/"))
      .map((fabric) => fabric.id);
    expect(unphotographed).toEqual([]);
  });

  it("carries a price for every cloth it offers", () => {
    const unpriced = fabrics
      .filter((fabric) => !priceList.some((entry) => entry.fabricId === fabric.id))
      .map((fabric) => fabric.id);
    expect(unpriced).toEqual([]);
  });

  it("still offers every cloth a published style is cut from", () => {
    const needed = styles.map((style) => style.priceEntryId.split("--")[1]);
    const missing = needed.filter((id) => !fabrics.some((fabric) => fabric.id === id));
    expect(missing).toEqual([]);
  });
});

describe("the price list", () => {
  it("names only fabrics and categories that exist", () => {
    const orphans = priceList
      .filter(
        (entry) =>
          !fabrics.some((fabric) => fabric.id === entry.fabricId) ||
          !categories.some((category) => category.id === entry.categoryId),
      )
      .map((entry) => entry.id);
    expect(orphans).toEqual([]);
  });
});
