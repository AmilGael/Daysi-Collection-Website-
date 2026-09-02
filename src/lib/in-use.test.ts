import { describe, expect, it } from "vitest";
import type { GarmentStyle, PriceListEntry } from "@/content/types";
import { stylesUsingEntry, stylesUsingFabric } from "./in-use";

const style = (id: string, priceEntryId: string): GarmentStyle => ({
  id,
  slug: id,
  name: { en: id, es: id },
  categoryId: priceEntryId.split("--")[0] ?? "dresses",
  priceEntryId,
  color: { en: "Blue", es: "Azul" },
  description: { en: "Description", es: "Descripción" },
  detail: { en: "Detail", es: "Detalle" },
  sizes: [],
  photos: [],
  customizationAvailable: true,
  isPublished: true,
});

const entry = (id: string, fabricId: string): PriceListEntry => ({
  id,
  categoryId: id.split("--")[0] ?? "dresses",
  fabricId,
  fixedPrice: 100,
  customizationExtra: 0,
  customizationNote: { en: "", es: "" },
  effectiveDate: "2026-09-03",
});

describe("styles in use", () => {
  const styles = [
    style("one", "dresses--wax-print"),
    style("two", "dresses--wax-print"),
    style("three", "shirts--wax-print"),
    style("four", "pants--missing-fabric"),
  ];
  const entries = [
    entry("dresses--wax-print", "wax-print"),
    entry("shirts--wax-print", "wax-print"),
  ];

  it("counts styles pricing through one entry", () => {
    expect(stylesUsingEntry(styles, "dresses--wax-print")).toBe(2);
  });

  it("counts every entry for one fabric", () => {
    expect(stylesUsingFabric(styles, entries, "wax-print")).toBe(3);
    expect(stylesUsingFabric(styles, entries, "unknown")).toBe(0);
  });

  it("falls back to the entry id shape when the entry is missing", () => {
    expect(stylesUsingFabric(styles, entries, "missing-fabric")).toBe(1);
  });
});
