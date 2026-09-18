import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-live-pricing-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("retired fabrics and price entries", () => {
  it("keeps retired records manageable while removing them from live reads", async () => {
    const {
      liveFabrics,
      livePriceList,
      manageableCustomFabrics,
      manageablePriceList,
      saveCustomFabric,
    } = await import("./live-pricing");
    const { setRetired } = await import("./retired");

    await saveCustomFabric({
      id: "cereza",
      name: "Cereza",
      swatchImage: "/uploads/a.jpg",
      averageColor: "#aabbcc",
      prices: { dresses: 12000 },
    });
    expect(livePriceList().some((entry) => entry.id === "dresses--cereza")).toBe(true);
    expect(liveFabrics().some((fabric) => fabric.id === "cereza")).toBe(true);

    await setRetired("fabric", "cereza", true);
    expect(livePriceList().some((entry) => entry.id === "dresses--cereza")).toBe(false);
    expect(liveFabrics().some((fabric) => fabric.id === "cereza")).toBe(false);
    expect(manageableCustomFabrics()).toContainEqual(
      expect.objectContaining({ id: "cereza", retired: true }),
    );

    await setRetired("fabric", "cereza", false);
    await setRetired("price-entry", "dresses--cereza", true);
    expect(livePriceList().some((entry) => entry.id === "dresses--cereza")).toBe(false);
    expect(manageablePriceList()).toContainEqual(
      expect.objectContaining({ id: "dresses--cereza", retired: true }),
    );
  });
});

describe("a garment's price", () => {
  const entry = {
    id: "heritage--frutera-print",
    categoryId: "heritage",
    fabricId: "frutera-print",
    fixedPrice: 29500,
    customizationExtra: 12000,
    customizationNote: { en: "Made to your measurements.", es: "Hecho a su medida." },
    effectiveDate: "2026-09-01",
  };
  const style = { priceEntryId: "heritage--frutera-print" };

  it("uses the entry's numbers when the garment has no price of its own", async () => {
    const { resolveStylePrice } = await import("./live-pricing");
    expect(resolveStylePrice(style, [entry])).toEqual({
      entryId: "heritage--frutera-print",
      fabricId: "frutera-print",
      fixedPrice: 29500,
      customizationExtra: 12000,
      customizationNote: entry.customizationNote,
      own: false,
    });
  });

  it("replaces both numbers with the garment's own and keeps the entry's note", async () => {
    const { resolveStylePrice } = await import("./live-pricing");
    const price = resolveStylePrice({ ...style, ownPrice: { fixedPrice: 25000, customizationExtra: 9000 } }, [entry]);
    expect(price).toMatchObject({ fixedPrice: 25000, customizationExtra: 9000, own: true });
    expect(price?.customizationNote).toEqual(entry.customizationNote);
  });

  it("keeps the entry's extra when the garment names only a price", async () => {
    const { resolveStylePrice } = await import("./live-pricing");
    const price = resolveStylePrice({ ...style, ownPrice: { fixedPrice: 25000 } }, [entry]);
    expect(price).toMatchObject({ fixedPrice: 25000, customizationExtra: 12000, own: true });
  });

  it("is null when the pair has no live entry, own price or not", async () => {
    const { resolveStylePrice } = await import("./live-pricing");
    expect(resolveStylePrice({ ...style, ownPrice: { fixedPrice: 25000 } }, [])).toBeNull();
  });

  it("is null when the entry is retired, even with an own price", async () => {
    const { priceFor } = await import("./live-pricing");
    const { setRetired } = await import("./retired");
    const { styles } = await import("@/content");
    const frutera = { ...styles.find((candidate) => candidate.id === "frutera")!, ownPrice: { fixedPrice: 25000 } };
    expect(priceFor(frutera)?.fixedPrice).toBe(25000);
    await setRetired("price-entry", frutera.priceEntryId, true);
    expect(priceFor(frutera)).toBeNull();
  });

  it("prices a garment through an entry Daysi wrote herself", async () => {
    const { priceFor, saveCustomEntry, withPrices } = await import("./live-pricing");
    const { styles } = await import("@/content");
    const frutera = styles.find((candidate) => candidate.id === "frutera")!;
    const moved = { ...frutera, priceEntryId: "heritage--cereza" };
    expect(priceFor(moved)).toBeNull();
    await saveCustomEntry({ ...entry, id: "heritage--cereza", fabricId: "cereza", fixedPrice: 31000 });
    expect(priceFor(moved)?.fixedPrice).toBe(31000);
    expect(withPrices([moved, frutera]).map((priced) => priced.price?.fixedPrice)).toEqual([31000, 31500]);
  });
});
