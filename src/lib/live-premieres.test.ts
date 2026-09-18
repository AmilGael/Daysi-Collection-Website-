import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Localized, Premiere } from "@/content/types";
import { assemblePremieres, type AddedPremiere, type PremiereOverride } from "./live-premieres";

/**
 * The live layer over the seeded premieres, the same idea as
 * `live-catalog.test.ts`: pure merge rules tested directly, then the reader
 * that ties them to the filesystem tested through a temp DATA_DIR.
 */

const localized = (es: string): Localized => ({ es, en: es });

function fixture(id: string, releaseDate: string, overrides: Partial<Premiere> = {}): Premiere {
  return {
    id,
    slug: id,
    season: localized(`Temporada ${id}`),
    title: localized(`Título ${id}`),
    story: localized(`Historia de ${id}`),
    inspiration: localized(`Inspiración de ${id}`),
    revealDate: releaseDate,
    releaseDate,
    piecesPlanned: 5,
    editionSize: 10,
    coverImage: `/images/real/${id}.jpg`,
    styleIds: [],
    ...overrides,
  };
}

describe("assemblePremieres", () => {
  // Seeded newest first, as the real content is: `b` releases after `a`.
  const seed = [fixture("b", "2026-06-01"), fixture("a", "2026-01-01")];

  it("keeps the seed order newest first and slots an added premiere by its release date", () => {
    const added: AddedPremiere = { ...fixture("c", "2026-03-01"), added: true, addedAt: "2026-03-01T00:00:00.000Z" };
    const result = assemblePremieres(seed, [added], []);
    expect(result.map((premiere) => premiere.id)).toEqual(["b", "c", "a"]);
  });

  it("applies an override field by field and leaves the rest", () => {
    const override: PremiereOverride = {
      premiereId: "a",
      piecesPlanned: 9,
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const result = assemblePremieres(seed, [], [override]);
    const a = result.find((premiere) => premiere.id === "a")!;
    expect(a.piecesPlanned).toBe(9);
    expect(a.title).toEqual(seed[1]!.title);
    expect(a.editionSize).toBe(seed[1]!.editionSize);
    expect(a.releaseDate).toBe(seed[1]!.releaseDate);
  });

  it("an added premiere sharing a seed id replaces it", () => {
    const added: AddedPremiere = {
      ...fixture("a", "2026-01-01", { title: localized("Corregido"), piecesPlanned: 3 }),
      added: true,
      addedAt: "2026-02-01T00:00:00.000Z",
    };
    const result = assemblePremieres(seed, [added], []);
    expect(result).toHaveLength(2);
    const a = result.find((premiere) => premiere.id === "a")!;
    expect(a.title.es).toBe("Corregido");
    expect(a.piecesPlanned).toBe(3);
  });

  it("drops a retired premiere", () => {
    const result = assemblePremieres(seed, [], [], new Set(["a"]));
    expect(result.map((premiere) => premiere.id)).toEqual(["b"]);
  });
});

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-live-premieres-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("the live premieres", () => {
  it("livePremiereListing names an added future premiere as next", async () => {
    const { saveAddedPremiere, livePremiereListing } = await import("./live-premieres");

    // The day after the newest seeded season (otono-2026, 2026-10-06) has
    // released: the seed alone has no next season on this day.
    const dayAfterLastRelease = new Date("2026-10-07T12:00:00Z");
    expect(livePremiereListing(dayAfterLastRelease).next).toBeUndefined();

    const future: AddedPremiere = {
      ...fixture("est-future", "2026-11-01", {
        slug: "est-future",
        revealDate: "2026-10-15",
        coverImage: "/uploads/future.jpg",
      }),
      added: true,
      addedAt: new Date().toISOString(),
    };
    await saveAddedPremiere(future);

    expect(livePremiereListing(dayAfterLastRelease).next?.id).toBe("est-future");
  });

  it("liveFindPremiere finds an added season by its id or its slug, and never a retired one", async () => {
    const { saveAddedPremiere, liveFindPremiere } = await import("./live-premieres");
    const { setRetired } = await import("./retired");

    const added: AddedPremiere = {
      ...fixture("est-a1b2c3d4", "2026-12-01", { slug: "una-nueva-temporada" }),
      added: true,
      addedAt: new Date().toISOString(),
    };
    await saveAddedPremiere(added);

    expect(liveFindPremiere("est-a1b2c3d4")?.slug).toBe("una-nueva-temporada");
    expect(liveFindPremiere("una-nueva-temporada")?.id).toBe("est-a1b2c3d4");

    await setRetired("premiere", "est-a1b2c3d4", true);
    expect(liveFindPremiere("est-a1b2c3d4")).toBeUndefined();
  });

  it("livePremieres reflects a garment ticked onto a season's checklist, by that season's own styleIds", async () => {
    // The other half of the "Parte del estreno" tag fix
    // (`collection/[slug]/page.test.ts`): the page finds a garment's season
    // by scanning `livePremieres()` for one whose `styleIds` includes it, so
    // this layer has to actually carry a checklist edit through.
    const { saveAddedPremiere, livePremieres } = await import("./live-premieres");

    const added: AddedPremiere = {
      ...fixture("est-checklist", "2026-12-01", { styleIds: [] }),
      added: true,
      addedAt: new Date().toISOString(),
    };
    await saveAddedPremiere(added);
    // Not on either seeded season's checklist (otono-2026 has only "sirena";
    // verano-2026 has the other five), so this is a clean starting point.
    expect(livePremieres().find((premiere) => premiere.styleIds.includes("yurumein"))).toBeUndefined();

    const { savePremiereOverride } = await import("./live-premieres");
    await savePremiereOverride({ premiereId: "est-checklist", styleIds: ["yurumein"] });

    expect(livePremieres().find((premiere) => premiere.styleIds.includes("yurumein"))?.id).toBe("est-checklist");
  });

  it("manageablePremieres marks a season she added and a season she retired, without dropping either", async () => {
    const { saveAddedPremiere, manageablePremieres } = await import("./live-premieres");
    const { setRetired } = await import("./retired");

    const added: AddedPremiere = { ...fixture("est-b", "2026-12-01"), added: true, addedAt: new Date().toISOString() };
    await saveAddedPremiere(added);
    await setRetired("premiere", "est-b", true);

    const rows = manageablePremieres();
    const row = rows.find((premiere) => premiere.id === "est-b");
    expect(row).toMatchObject({ added: true, retired: true });
  });
});
