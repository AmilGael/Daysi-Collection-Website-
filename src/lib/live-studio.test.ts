import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GarmentStyle } from "@/content/types";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-live-studio-"));
  process.env.DATA_DIR = dir;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const added: GarmentStyle = {
  id: "sty-studio01",
  slug: "studio-one",
  name: { es: "Prueba", en: "Test" },
  categoryId: "dresses",
  priceEntryId: "dresses--daisy-cotton",
  color: { es: "", en: "" },
  description: { es: "Una prueba", en: "A test" },
  detail: { es: "", en: "" },
  sizes: [{ sizeId: "s", inStock: true }],
  photos: [{ src: "/uploads/img-studio01.jpg", alt: { es: "", en: "" }, isPrimary: true }],
  customizationAvailable: true,
  isPublished: true,
  inStudio: true,
};

describe("liveStudioStyles", () => {
  it("offers a garment switched on, and drops it when hidden, unpublished or retired", async () => {
    const catalog = await import("./live-catalog");
    const { setRetired } = await import("./retired");

    expect(catalog.liveStudioStyles().map((style) => style.id)).not.toContain("sty-studio01");
    await catalog.saveAddedStyle(added);
    expect(catalog.liveStudioStyles().map((style) => style.id)).toContain("sty-studio01");

    await catalog.saveStyleOverride({ styleId: "sty-studio01", isPublished: false, stock: {} });
    expect(catalog.liveStudioStyles().map((style) => style.id)).not.toContain("sty-studio01");

    await catalog.saveStyleOverride({ styleId: "sty-studio01", isPublished: true, stock: {}, inStudio: false });
    expect(catalog.liveStudioStyles().map((style) => style.id)).not.toContain("sty-studio01");

    await catalog.saveStyleOverride({ styleId: "sty-studio01", isPublished: true, stock: {}, inStudio: true });
    expect(catalog.liveStudioStyles().map((style) => style.id)).toContain("sty-studio01");

    await setRetired("style", "sty-studio01", true);
    expect(catalog.liveStudioStyles().map((style) => style.id)).not.toContain("sty-studio01");
  });
});
