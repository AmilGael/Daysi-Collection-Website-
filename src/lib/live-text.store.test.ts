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

  it("feeds overrides through every live and office catalog reader", async () => {
    const { styles } = await import("@/content");
    const { galleryWorks } = await import("@/content/gallery");
    const { saveTextOverride } = await import("./live-text");
    const style = styles.find((candidate) => candidate.isPublished)!;
    const work = galleryWorks[0]!;

    await saveTextOverride({
      subject: "style",
      id: style.id,
      field: "name",
      locale: "en",
      value: "Wired garment name",
    });
    await saveTextOverride({
      subject: "gallery",
      id: work.id,
      field: "caption",
      locale: "es",
      value: "Pie de foto conectado",
    });

    const { liveStyles, manageableStyles } = await import("./live-catalog");
    const { liveGallery, manageableGallery } = await import("./live-gallery");
    expect(liveStyles().find((candidate) => candidate.id === style.id)?.name.en)
      .toBe("Wired garment name");
    expect(manageableStyles().find((candidate) => candidate.id === style.id)?.name.en)
      .toBe("Wired garment name");
    expect(liveGallery().find((candidate) => candidate.id === work.id)?.caption.es)
      .toBe("Pie de foto conectado");
    expect(manageableGallery().find((candidate) => candidate.id === work.id)?.caption.es)
      .toBe("Pie de foto conectado");
  });
});
