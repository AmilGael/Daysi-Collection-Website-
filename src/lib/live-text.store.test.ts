import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `records.ts` reads the data directory into a module-level constant, so the
// store tests reset the module registry and import inside the test. Copied
// from src/lib/office-history.test.ts; keep the two in step.
let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-text-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("saveTextOverride", () => {
  it("writes one record per field and language, newest winning", async () => {
    const { saveTextOverride, textOverrides } = await import("./live-text");
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "description",
      locale: "es",
      value: "Primera",
    });
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "description",
      locale: "es",
      value: "Segunda",
    });
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "description",
      locale: "en",
      value: "English",
    });

    const overrides = textOverrides();
    expect(overrides).toHaveLength(2);
    expect(overrides.find((record) => record.locale === "es")!.value).toBe("Segunda");
    expect(overrides.find((record) => record.locale === "en")!.value).toBe("English");
  });
});
