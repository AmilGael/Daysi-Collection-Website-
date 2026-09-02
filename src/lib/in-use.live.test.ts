import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-in-use-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("live styles in use", () => {
  it("counts a custom style until that style is retired", async () => {
    const { saveAddedStyle } = await import("./live-catalog");
    const { saveCustomEntry, saveCustomFabric } = await import("./live-pricing");
    const { liveStylesUsingEntry, liveStylesUsingFabric } = await import("./in-use");
    const { setRetired } = await import("./retired");
    const fabricId = "cereza";
    const entryId = `dresses--${fabricId}`;
    const styleId = "vestido-cereza";

    await saveCustomFabric({
      id: fabricId,
      name: "Cereza",
      swatchImage: "/uploads/cereza.jpg",
      averageColor: "#aabbcc",
      prices: {},
    });
    await saveCustomEntry({
      id: entryId,
      categoryId: "dresses",
      fabricId,
      fixedPrice: 12000,
      customizationExtra: 9500,
      customizationNote: { en: "Custom", es: "A la medida" },
      effectiveDate: "2026-09-03",
    });
    await saveAddedStyle({
      id: styleId,
      slug: styleId,
      name: { en: "Cherry dress", es: "Vestido cereza" },
      categoryId: "dresses",
      priceEntryId: entryId,
      color: { en: "Cherry", es: "Cereza" },
      description: { en: "Description", es: "Descripción" },
      detail: { en: "Detail", es: "Detalle" },
      sizes: [{ sizeId: "m", inStock: true }],
      photos: [],
      customizationAvailable: true,
      isPublished: true,
    });

    expect(liveStylesUsingFabric(fabricId)).toBe(1);
    expect(liveStylesUsingEntry(entryId)).toBe(1);

    await setRetired("style", styleId, true);
    expect(liveStylesUsingFabric(fabricId)).toBe(0);
    expect(liveStylesUsingEntry(entryId)).toBe(0);
  });

  it("refuses to restore a style whose price entry is retired", async () => {
    const { manageableStyles, saveAddedStyle } = await import("./live-catalog");
    const { livePriceList, saveCustomEntry, saveCustomFabric } = await import("./live-pricing");
    const { restoreRefusal } = await import("./in-use");
    const { setRetired } = await import("./retired");
    const fabricId = "ciruela";
    const entryId = `dresses--${fabricId}`;
    const styleId = "vestido-ciruela";

    await saveCustomFabric({ id: fabricId, name: "Ciruela", swatchImage: "/uploads/ciruela.jpg", averageColor: "#663355", prices: {} });
    await saveCustomEntry({
      id: entryId, categoryId: "dresses", fabricId, fixedPrice: 13000,
      customizationExtra: 9500, customizationNote: { en: "Custom", es: "A la medida" },
      effectiveDate: "2026-09-03",
    });
    await saveAddedStyle({
      id: styleId, slug: styleId, name: { en: "Plum dress", es: "Vestido ciruela" },
      categoryId: "dresses", priceEntryId: entryId,
      color: { en: "Plum", es: "Ciruela" },
      description: { en: "Description", es: "Descripción" }, detail: { en: "Detail", es: "Detalle" },
      sizes: [{ sizeId: "m", inStock: true }], photos: [], customizationAvailable: true, isPublished: true,
    });
    await setRetired("style", styleId, true);
    await setRetired("price-entry", entryId, true);

    const style = manageableStyles().find((candidate) => candidate.id === styleId)!;
    expect(restoreRefusal(style, livePriceList())).toBe("entry-retired");
  });
});
