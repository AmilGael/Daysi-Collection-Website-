import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-retired-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("retired records", () => {
  it("starts empty", async () => {
    const { retiredSet } = await import("./retired");
    expect(retiredSet("style")).toEqual(new Set());
  });

  it("includes an id after it is retired", async () => {
    const { retiredSet, setRetired } = await import("./retired");
    await setRetired("style", "x", true);
    expect(retiredSet("style")).toEqual(new Set(["x"]));
  });

  it("excludes an id after it is restored", async () => {
    const { retiredSet, setRetired } = await import("./retired");
    await setRetired("style", "x", true);
    await setRetired("style", "x", false);
    expect(retiredSet("style")).toEqual(new Set());
  });

  it("uses the newest record after repeated retires and a restore", async () => {
    const { retiredSet, setRetired } = await import("./retired");
    await setRetired("style", "x", true);
    await setRetired("style", "x", true);
    await setRetired("style", "x", false);
    expect(retiredSet("style")).toEqual(new Set());
  });

  it.each(["fabric", "price-entry", "request"] as const)(
    "retires and restores a %s",
    async (kind) => {
      const { retiredSet, setRetired } = await import("./retired");
      await setRetired(kind, "x", true);
      expect(retiredSet(kind)).toEqual(new Set(["x"]));
      await setRetired(kind, "x", false);
      expect(retiredSet(kind)).toEqual(new Set());
    },
  );

  it("keeps kinds separate", async () => {
    const { retiredSet, setRetired } = await import("./retired");
    await setRetired("price-entry", "x", true);
    expect(retiredSet("request")).toEqual(new Set());
    expect(retiredSet("gallery")).toEqual(new Set());
  });

  it("builds the record key from the kind and id", async () => {
    const { retiredKey } = await import("./retired");
    expect(retiredKey("gallery", "work-1")).toBe("gallery:work-1");
  });
});
