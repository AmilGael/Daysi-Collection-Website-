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
