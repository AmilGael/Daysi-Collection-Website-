import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `labelFor`'s own reuse rule: a promotion that has carried this Spanish
 * label before comes back with the English it already has, so a switch or
 * a date edit never pays for a fresh translation call. The one exception is
 * the point of the Sunday fix — an English that is only a copy of the
 * Spanish (saved while there was no key at all) is not carried forward once
 * a key arrives, or that copy would follow the label forever.
 */

const state = vi.hoisted(() => ({ requestHeaders: new Headers() }));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => state.requestHeaders) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentViewer: vi.fn(async () => ({ role: "owner" })) }));

let dataDirectory: string;

beforeEach(() => {
  vi.resetModules();
  state.requestHeaders = new Headers({ origin: "https://shop.test", host: "shop.test" });
  dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "daysi-shopfront-actions-"));
  process.env.DATA_DIR = dataDirectory;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  fs.rmSync(dataDirectory, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.ANTHROPIC_API_KEY;
});

function promotionChange(over: Record<string, unknown> = {}) {
  return {
    type: "promotion",
    key: "promotion:draft",
    kind: "percent",
    value: 15,
    scope: { type: "all" },
    active: true,
    label: "Rebaja",
    ...over,
  };
}

describe("a promotion's English, once it has been saved before", () => {
  it("with no key, keeps reusing the copied English exactly as before", async () => {
    const { applyShopfrontChanges } = await import("./actions");
    const { manageablePromotions } = await import("@/lib/live-promotions");

    const first = await applyShopfrontChanges([promotionChange()]);
    expect(first.ok).toBe(true);
    const created = manageablePromotions()[0]!;
    expect(created.label).toEqual({ es: "Rebaja", en: "Rebaja" });

    // Toggled off — same label, same id — still with no key.
    const second = await applyShopfrontChanges([
      promotionChange({ key: "promotion:toggle", id: created.id, active: false }),
    ]);
    expect(second.ok).toBe(true);
    const after = manageablePromotions().find((promotion) => promotion.id === created.id)!;
    expect(after.label).toEqual({ es: "Rebaja", en: "Rebaja" });
  });

  it("gets real English on its next save once a key arrives, rather than carrying the copy forward", async () => {
    const { applyShopfrontChanges } = await import("./actions");
    const { manageablePromotions } = await import("@/lib/live-promotions");

    const first = await applyShopfrontChanges([promotionChange()]);
    expect(first.ok).toBe(true);
    const created = manageablePromotions().find((promotion) => promotion.label.es === "Rebaja")!;
    expect(created.label).toEqual({ es: "Rebaja", en: "Rebaja" });

    // A key arrives; the same label is saved again (a toggle) — fresh
    // modules so `env.ts` and `translate.ts` are re-read with it present.
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = "sk-test";
    vi.doMock("@/lib/translate", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/translate")>();
      return { ...actual, translateToEnglish: vi.fn(async () => ({ label: "Sale" })) };
    });

    const { applyShopfrontChanges: applyAgain } = await import("./actions");
    const second = await applyAgain([
      promotionChange({ key: "promotion:toggle", id: created.id, active: false }),
    ]);
    expect(second.ok).toBe(true);

    const { manageablePromotions: promotionsAgain } = await import("@/lib/live-promotions");
    const after = promotionsAgain().find((promotion) => promotion.id === created.id)!;
    expect(after.label).toEqual({ es: "Rebaja", en: "Sale" });
    vi.doUnmock("@/lib/translate");
  });
});
