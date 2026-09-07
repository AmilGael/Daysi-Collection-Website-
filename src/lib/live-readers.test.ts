import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { GarmentStyle, PriceListEntry } from "@/content/types";

/**
 * Every reader that names or prices a garment goes through the live catalog:
 * the coded styles with Daysi's corrections, additions and retirements on top.
 * Before this, a garment she added from the office could be browsed but never
 * ordered, and a name she corrected was still wrong in the cart line, the
 * request email, the premiere list and the browser tab.
 */

let dir: string;

const SOL: GarmentStyle = {
  id: "sol",
  slug: "sol",
  name: { en: "Sol dress", es: "Vestido Sol" },
  categoryId: "heritage",
  priceEntryId: "heritage--sol-linen",
  color: { en: "Yellow", es: "Amarillo" },
  description: { en: "Added from the office.", es: "Agregado desde la oficina." },
  detail: { en: "", es: "" },
  sizes: [{ sizeId: "s", inStock: true }],
  photos: [],
  customizationAvailable: false,
  isPublished: true,
};

const SOL_PRICE: PriceListEntry = {
  id: "heritage--sol-linen",
  categoryId: "heritage",
  fabricId: "linen",
  fixedPrice: 12000,
  customizationExtra: 0,
  customizationNote: { en: "", es: "" },
  effectiveDate: "2026-09-07",
};

beforeEach(async () => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-live-readers-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");

  const { saveAddedStyle } = await import("./live-catalog");
  const { saveCustomEntry } = await import("./live-pricing");
  const { saveTextOverride } = await import("./live-text");
  await saveAddedStyle(SOL);
  await saveCustomEntry(SOL_PRICE);
  await saveTextOverride({ subject: "style", id: "sol", field: "name", locale: "en", value: "Sol dress, corrected" });
  await saveTextOverride({ subject: "style", id: "frutera", field: "name", locale: "en", value: "Frutera, corrected" });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("pricing an added garment", () => {
  it("prices a garment Daysi added, under its corrected name", async () => {
    const { estimateReadyMade } = await import("./pricing");
    const estimate = estimateReadyMade({ styleSlug: "sol", sizeId: "s", customize: false });
    expect(estimate?.subtotal).toBe(12000);
    expect(estimate?.lines[0]?.label.en).toBe("Sol dress, corrected");
  });

  it("prices a cart holding a garment Daysi added", async () => {
    const { estimateCart } = await import("./pricing");
    const estimate = estimateCart([{ styleSlug: "sol", sizeId: "s", customize: false, quantity: 2 }]);
    expect(estimate?.subtotal).toBe(24000);
    expect(estimate?.lines[0]?.label.en).toBe("Sol dress, corrected");
  });

  it("refuses a garment that is not in the live catalog", async () => {
    const { estimateReadyMade } = await import("./pricing");
    expect(estimateReadyMade({ styleSlug: "nobody", sizeId: "s", customize: false })).toBeNull();
  });
});

describe("the request form", () => {
  it("accepts an order for a garment Daysi added", async () => {
    const { requestSchema } = await import("./validation");
    const parsed = requestSchema.safeParse({
      kind: "order",
      website: "",
      renderedAt: Date.now() - 10_000,
      client: { name: "Ana", email: "ana@example.com", phone: "9175550100", preferredContact: "email", locale: "en" },
      styleSlug: "sol",
      sizeId: "s",
      customize: false,
      notes: "",
      acceptedTerms: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("writes the corrected name into the record Daysi reads", async () => {
    const { POST } = await import("@/app/api/requests/route");
    const { findRequest } = await import("./request-store");
    const response = await POST(
      new Request("http://localhost:3000/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
        body: JSON.stringify({
          kind: "order",
          website: "",
          renderedAt: Date.now() - 10_000,
          client: { name: "Ana", email: "ana@example.com", phone: "9175550100", preferredContact: "email", locale: "en" },
          styleSlug: "sol",
          sizeId: "s",
          customize: false,
          notes: "",
          acceptedTerms: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const { reference } = (await response.json()) as { reference: string };
    expect(findRequest(reference)?.details.Style).toBe("Sol dress, corrected");
  });
});

describe("the premiere list", () => {
  it("shows a premiere's garments with their corrected names", async () => {
    const { liveStylesInPremiere } = await import("./live-catalog");
    const { premieres } = await import("@/content");
    const premiere = premieres.find((candidate) => candidate.styleIds.includes("frutera"))!;
    const names = liveStylesInPremiere(premiere).map((style) => style.name.en);
    expect(names).toContain("Frutera, corrected");
  });
});
