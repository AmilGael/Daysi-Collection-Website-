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
