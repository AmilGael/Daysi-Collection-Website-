import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the office writes when Daysi types how many pieces she has. Only the
 * sizes she changed arrive; the rest keep their number and the moment it
 * was counted, so a sale made while her page was open is not undone.
 */

const state = vi.hoisted(() => ({ requestHeaders: new Headers() }));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => state.requestHeaders) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentViewer: vi.fn(async () => ({ role: "owner" })) }));

const EARLIER = "2026-09-01T12:00:00.000Z";
let dataDirectory: string;

beforeEach(() => {
  vi.resetModules();
  state.requestHeaders = new Headers({ origin: "https://shop.test", host: "shop.test" });
  dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "daysi-collection-stock-"));
  process.env.DATA_DIR = dataDirectory;
});

afterEach(() => {
  fs.rmSync(dataDirectory, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

async function counted(stock: Record<string, boolean | number>, countedAt: Record<string, string>) {
  const { saveStyleOverride } = await import("./live-catalog");
  await saveStyleOverride({ styleId: "frutera", isPublished: true, stock, countedAt });
}

async function newest() {
  const { styleOverrides } = await import("./live-catalog");
  return styleOverrides().find((record) => record.styleId === "frutera")!;
}

async function apply(change: Record<string, unknown>) {
  const { applyCollectionChanges } = await import("@/app/[locale]/office/collection/actions");
  return applyCollectionChanges([{ type: "style-override", key: "style:frutera", styleId: "frutera", isPublished: true, ...change }]);
}

describe("typing a count in the office", () => {
  it("stamps the size she typed and leaves the others as they were counted", async () => {
    await counted({ s: 2, m: 1, l: true }, { s: EARLIER, m: EARLIER });

    await apply({ stock: { s: 3 } });

    const record = await newest();
    expect(record.stock).toEqual({ s: 3, m: 1, l: true });
    expect(record.countedAt?.m).toBe(EARLIER);
    expect(record.countedAt?.s! > EARLIER).toBe(true);
  });

  it("does not bring back a piece that sold while her page was open", async () => {
    await counted({ s: 2, m: 1 }, { s: EARLIER, m: EARLIER });
    const { saveRequest } = await import("./request-store");
    await saveRequest({
      reference: "ORD-SOLD",
      kind: "order",
      submittedAt: "2026-09-10T12:00:00.000Z",
      locale: "es",
      client: { name: "Ana", email: "ana@example.com" },
      details: {},
      pieces: [{ styleId: "frutera", sizeId: "m", quantity: 1, madeToMeasure: false }],
      status: "paid",
      source: "stripe",
      paidAt: "2026-09-10T12:05:00.000Z",
    });

    await apply({ stock: { s: 3 } });

    const { allLiveStyles } = await import("./live-catalog");
    const m = allLiveStyles().find((style) => style.id === "frutera")!.sizes.find((size) => size.sizeId === "m");
    expect(m).toEqual({ sizeId: "m", inStock: false, count: 0 });
  });

  it("keeps the moment an undo brings back, so sales since then still count", async () => {
    await counted({ s: 5 }, { s: "2026-09-12T00:00:00.000Z" });

    await apply({ stock: { s: 2 }, countedAt: { s: EARLIER } });

    expect((await newest()).countedAt?.s).toBe(EARLIER);
  });
});

describe("a new garment with its pieces counted", () => {
  const create = {
    type: "style-create",
    key: "style-create:1",
    name: "Camisa Sol",
    description: "Una camisa de algodón con botones de coco.",
    detail: "",
    color: "Amarilla",
    categoryId: "shirts",
    fabricId: "daisy-cotton",
    fixedPrice: 10500,
    photos: ["/uploads/img-sol.jpg"],
    inStudio: false,
  };

  async function createWith(sizes: Record<string, number>) {
    const { applyCollectionChanges } = await import("@/app/[locale]/office/collection/actions");
    return applyCollectionChanges([{ ...create, sizes }]);
  }

  it("goes on the rack with the number of each size she has", async () => {
    await createWith({ s: 1, m: 0, l: 2 });

    const { allLiveStyles } = await import("./live-catalog");
    const sol = allLiveStyles().find((style) => style.name.es === "Camisa Sol")!;
    expect(sol.sizes).toEqual([
      { sizeId: "s", inStock: true, count: 1 },
      { sizeId: "m", inStock: false, count: 0 },
      { sizeId: "l", inStock: true, count: 2 },
    ]);
  });

  it("is refused with nothing to sell in any size", async () => {
    const result = await createWith({ s: 0, m: 0, l: 0 });
    expect(result).toEqual({ ok: true, results: [{ key: "style-create:1", ok: false, error: "no-sizes" }] });
  });
});

/**
 * The same actions, for a garment's own price: set on the sheet of a new or
 * an existing garment, kept on its override line, and the list left alone.
 */
describe("a garment's own price from the office", () => {
  const create = {
    type: "style-create",
    key: "style-create:1",
    name: "Camisa Sol",
    description: "Una camisa de algodón con botones de coco.",
    detail: "",
    color: "Amarilla",
    categoryId: "shirts",
    photos: ["/uploads/img-sol.jpg"],
    inStudio: false,
    sizes: { s: true, m: false, l: false },
  };

  async function run(change: Record<string, unknown>) {
    const { applyCollectionChanges } = await import("@/app/[locale]/office/collection/actions");
    return applyCollectionChanges([change]);
  }

  async function sol() {
    const { allLiveStyles } = await import("./live-catalog");
    return allLiveStyles().find((style) => style.name.es === "Camisa Sol")!;
  }

  it("gives a new garment on a priced pair its own price, and leaves the list as it was", async () => {
    const { livePriceList, priceFor } = await import("./live-pricing");
    const before = livePriceList().find((entry) => entry.id === "shirts--daisy-cotton")!;

    await run({ ...create, fabricId: "daisy-cotton", fixedPrice: 9000, customizationExtra: 3000 });

    const garment = await sol();
    expect(garment.ownPrice).toEqual({ fixedPrice: 9000, customizationExtra: 3000 });
    expect(priceFor(garment)).toMatchObject({ fixedPrice: 9000, customizationExtra: 3000, own: true });
    expect(livePriceList().find((entry) => entry.id === "shirts--daisy-cotton")).toEqual(before);
  });

  it("puts the price of a new pair on the list, extra included, and the garment follows the list", async () => {
    const { saveCustomFabric, livePriceList } = await import("./live-pricing");
    await saveCustomFabric({ id: "cereza", name: "Cereza", swatchImage: "/uploads/a.jpg", averageColor: "#aabbcc", prices: { dresses: 12000 } });

    await run({ ...create, fabricId: "cereza", fixedPrice: 9000, customizationExtra: 3000 });

    expect(livePriceList().find((entry) => entry.id === "shirts--cereza")).toMatchObject({ fixedPrice: 9000, customizationExtra: 3000 });
    expect((await sol()).ownPrice).toBeUndefined();
  });

  it("refuses an own price under a dollar on a priced pair", async () => {
    const result = await run({ ...create, fabricId: "daisy-cotton", fixedPrice: 50 });
    expect(result).toEqual({ ok: true, results: [{ key: "style-create:1", ok: false, error: "bad-price" }] });
  });

  it("sets and clears an own price on a garment, and drops an extra sent without a price", async () => {
    await run({ type: "style-override", key: "style:frutera", styleId: "frutera", isPublished: true, stock: {}, fixedPrice: 20000 });
    expect((await newest()).fixedPrice).toBe(20000);

    await run({ type: "style-override", key: "style:frutera", styleId: "frutera", isPublished: true, stock: {}, customizationExtra: 5000 });
    const record = await newest();
    expect(record.fixedPrice).toBeUndefined();
    expect(record.customizationExtra).toBeUndefined();
  });
});
