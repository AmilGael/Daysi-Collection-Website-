import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredRequest } from "./request-store";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-office-history-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const request = (status: StoredRequest["status"]): StoredRequest => ({
  reference: "MSG-TEST",
  kind: "contact",
  submittedAt: "2026-09-03T12:00:00.000Z",
  locale: "es",
  client: { name: "Ana", email: "ana@example.com" },
  details: { message: "Hola" },
  status,
});

describe("office undo history", () => {
  it("returns the coded style baseline after one override and the first override after two", async () => {
    const { previousChangeFor, undoableIds } = await import("./office-history");
    const { saveStyleOverride } = await import("./live-catalog");

    expect(previousChangeFor("style-override", "frutera")).toBeUndefined();
    await saveStyleOverride({ styleId: "frutera", isPublished: false, stock: { m: false } });
    expect(previousChangeFor("style-override", "frutera")).toEqual({
      type: "style-override",
      key: "style:frutera",
      styleId: "frutera",
      isPublished: true,
      stock: { s: true, m: true, l: true },
    });
    expect(undoableIds("style-override")).toContain("frutera");

    await saveStyleOverride({
      styleId: "frutera",
      isPublished: true,
      stock: { s: false, m: false, l: false },
    });
    expect(previousChangeFor("style-override", "frutera")).toEqual({
      type: "style-override",
      key: "style:frutera",
      styleId: "frutera",
      isPublished: false,
      stock: { m: false },
    });
  });

  it("returns the coded price baseline after one entry override", async () => {
    const { priceList } = await import("@/content");
    const { previousChangeFor } = await import("./office-history");
    const { saveEntryOverride } = await import("./live-pricing");
    const coded = priceList[0]!;

    await saveEntryOverride({
      entryId: coded.id,
      fixedPrice: coded.fixedPrice + 100,
      customizationExtra: coded.customizationExtra + 100,
    });
    expect(previousChangeFor("price-entry", coded.id)).toEqual({
      type: "entry",
      key: `entry:${coded.id}`,
      id: coded.id,
      fixedPrice: coded.fixedPrice,
      customizationExtra: coded.customizationExtra,
    });
  });

  it("uses the empty notice floor and then the prior notice", async () => {
    const { previousChangeFor } = await import("./office-history");
    const { saveNotice } = await import("./live-catalog");

    await saveNotice({ message: "First", visible: true });
    expect(previousChangeFor("notice", "site")).toEqual({
      type: "notice",
      key: "notice:site",
      message: "",
      visible: false,
    });
    await saveNotice({ message: "Second", visible: true });
    expect(previousChangeFor("notice", "site")).toEqual({
      type: "notice",
      key: "notice:site",
      message: "First",
      visible: true,
    });
  });

  it("only makes request status undoable after a second line", async () => {
    const { previousChangeFor, undoableIds } = await import("./office-history");
    const { saveRequest } = await import("./request-store");

    await saveRequest(request("new"));
    expect(previousChangeFor("request-status", "MSG-TEST")).toBeUndefined();
    expect(undoableIds("request-status")).not.toContain("MSG-TEST");

    await saveRequest(request("answered"));
    expect(previousChangeFor("request-status", "MSG-TEST")).toEqual({
      type: "request-status",
      key: "request:MSG-TEST",
      kind: "contact",
      reference: "MSG-TEST",
      status: "new",
    });
  });

  it("reverses retirement records and keeps retirement kinds separate", async () => {
    const { previousChangeFor, undoableIds } = await import("./office-history");
    const { setRetired } = await import("./retired");

    await setRetired("gallery", "frutera", true);
    expect(undoableIds("retired:style")).not.toContain("frutera");

    await setRetired("style", "frutera", true);
    expect(undoableIds("retired:style")).toContain("frutera");
    expect(previousChangeFor("retired:style", "frutera")).toEqual({
      type: "restore",
      key: "style:frutera",
      id: "frutera",
    });

    await setRetired("style", "frutera", false);
    expect(previousChangeFor("retired:style", "frutera")).toEqual({
      type: "retire",
      key: "style:frutera",
      id: "frutera",
    });
  });
});
