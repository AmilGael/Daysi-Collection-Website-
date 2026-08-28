import { describe, expect, it } from "vitest";
import type { PriceListEntry } from "@/content/types";
import { assemblePriceList, type PriceEntryOverride } from "./live-pricing";

const entry = (id: string, fixedPrice = 10000): PriceListEntry => ({
  id,
  categoryId: id.split("--")[0]!,
  fabricId: id.split("--")[1]!,
  fixedPrice,
  customizationExtra: 5000,
  customizationNote: { en: "", es: "" },
  effectiveDate: "2026-08-01",
});

describe("assembling the published price list", () => {
  it("publishes the coded list when Daysi has added nothing", () => {
    expect(assemblePriceList([entry("shirts--wax-print")], [], [], []).map((e) => e.id)).toEqual([
      "shirts--wax-print",
    ]);
  });

  it("publishes a price for a garment and cloth she paired herself", () => {
    const result = assemblePriceList([], [], [entry("dresses--fish-batik", 42000)], []);
    expect(result.find((e) => e.id === "dresses--fish-batik")?.fixedPrice).toBe(42000);
  });

  it("lets her edit the price of an entry she created", () => {
    const custom = [entry("dresses--fish-batik", 42000)];
    const override: PriceEntryOverride = {
      entryId: "dresses--fish-batik",
      fixedPrice: 45000,
      customizationExtra: 5000,
      updatedAt: "2026-08-28T00:00:00.000Z",
    };
    const result = assemblePriceList([], [], custom, [override]);
    expect(result[0]?.fixedPrice).toBe(45000);
  });

  it("never lists the same garment and cloth twice", () => {
    const result = assemblePriceList(
      [entry("shirts--wax-print", 16500)],
      [],
      [entry("shirts--wax-print", 19000)],
      [],
    );
    expect(result).toHaveLength(1);
    // Hers is the newer decision, so hers is the published price.
    expect(result[0]?.fixedPrice).toBe(19000);
  });
});
