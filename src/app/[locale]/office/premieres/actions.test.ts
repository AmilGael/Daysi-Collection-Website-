import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `knownPairings`'s own reuse rule, the premieres side of the same Sunday
 * fix `shopfront/actions.test.ts` covers for a promotion's label: a field
 * sent back exactly as it was saved before reuses that pairing's English,
 * except when that English is only a copy of the Spanish (saved while
 * there was no key at all) — once a key arrives, that copy is translated
 * for real rather than carried forward on every later save.
 */

const state = vi.hoisted(() => ({ requestHeaders: new Headers() }));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => state.requestHeaders) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentViewer: vi.fn(async () => ({ role: "owner" })) }));

let dataDirectory: string;

// Seeded (content/premieres.ts): revealDate 2026-09-15, releaseDate 2026-10-06.
const PREMIERE_ID = "otono-2026";

beforeEach(() => {
  vi.resetModules();
  state.requestHeaders = new Headers({ origin: "https://shop.test", host: "shop.test" });
  dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "daysi-premieres-actions-"));
  process.env.DATA_DIR = dataDirectory;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  fs.rmSync(dataDirectory, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.ANTHROPIC_API_KEY;
});

function updateChange(over: Record<string, unknown> = {}) {
  return { type: "premiere-update", key: "premiere:draft", premiereId: PREMIERE_ID, ...over };
}

describe("a premiere field's English, once it has been saved before", () => {
  it("with no key, keeps reusing the copied English exactly as before", async () => {
    const { applyPremiereChanges } = await import("./actions");
    const { manageablePremieres } = await import("@/lib/live-premieres");

    const first = await applyPremiereChanges([updateChange({ season: "Temporada Piloto" })]);
    expect(first.ok).toBe(true);
    const afterFirst = manageablePremieres().find((premiere) => premiere.id === PREMIERE_ID)!;
    expect(afterFirst.season).toEqual({ es: "Temporada Piloto", en: "Temporada Piloto" });

    // Sent back unchanged (an undo, or another field's save carrying the same value).
    const second = await applyPremiereChanges([
      updateChange({ key: "premiere:again", season: "Temporada Piloto", piecesPlanned: 7 }),
    ]);
    expect(second.ok).toBe(true);
    const afterSecond = manageablePremieres().find((premiere) => premiere.id === PREMIERE_ID)!;
    expect(afterSecond.season).toEqual({ es: "Temporada Piloto", en: "Temporada Piloto" });
    expect(afterSecond.piecesPlanned).toBe(7);
  });

  it("gets real English on its next save once a key arrives, rather than carrying the copy forward", async () => {
    const { applyPremiereChanges } = await import("./actions");
    const { manageablePremieres } = await import("@/lib/live-premieres");

    const first = await applyPremiereChanges([updateChange({ season: "Temporada Piloto" })]);
    expect(first.ok).toBe(true);
    const afterFirst = manageablePremieres().find((premiere) => premiere.id === PREMIERE_ID)!;
    expect(afterFirst.season).toEqual({ es: "Temporada Piloto", en: "Temporada Piloto" });

    // A key arrives; the same season is saved again — fresh modules so
    // `env.ts` and `translate.ts` are re-read with it present.
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = "sk-test";
    vi.doMock("@/lib/translate", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/translate")>();
      return { ...actual, translateToEnglish: vi.fn(async () => ({ season: "Pilot Season" })) };
    });

    const { applyPremiereChanges: applyAgain } = await import("./actions");
    const second = await applyAgain([updateChange({ key: "premiere:again", season: "Temporada Piloto" })]);
    expect(second.ok).toBe(true);

    const { manageablePremieres: premieresAgain } = await import("@/lib/live-premieres");
    const afterSecond = premieresAgain().find((premiere) => premiere.id === PREMIERE_ID)!;
    expect(afterSecond.season).toEqual({ es: "Temporada Piloto", en: "Pilot Season" });
    vi.doUnmock("@/lib/translate");
  });
});
