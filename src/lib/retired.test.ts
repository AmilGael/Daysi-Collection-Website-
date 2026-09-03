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

describe("the per-request memo on retiredSet", () => {
  afterEach(() => vi.doUnmock("react"));

  it("is a passthrough in this test build, so a write is visible on the next read", async () => {
    const { cache } = await import("react");
    let calls = 0;
    const counted = cache(() => { calls += 1; return calls; });
    counted();
    counted();
    expect(calls).toBe(2);
  });

  it("is wrapped in React cache, so a memoising build reads the file once per kind", async () => {
    vi.doMock("react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("react")>();
      const memo = <A, R>(fn: (arg: A) => R) => {
        const seen = new Map<A, R>();
        return (arg: A) => {
          if (!seen.has(arg)) seen.set(arg, fn(arg));
          return seen.get(arg) as R;
        };
      };
      return { ...actual, cache: memo };
    });
    const { retiredSet, setRetired } = await import("./retired");
    expect(retiredSet("style")).toEqual(new Set());
    await setRetired("style", "x", true);
    expect(retiredSet("style"), "memoised within the scope").toEqual(new Set());
    expect(retiredSet("gallery"), "a different kind is a different entry").toEqual(new Set());
  });
});
