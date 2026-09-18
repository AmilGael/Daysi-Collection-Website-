import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * Galería is cards and a sheet since 18 September 2026, the same vocabulary
 * Colección was rebuilt in: a card grid, a "+" card, and a sheet per photo.
 * "Dónde va" can still follow a section she just named through "Otra…" into
 * a normal option (see the comment on `pendingSections` in the new-work
 * sheet), so a second photo can join it without typing the name again. If
 * that pending section then drops out — its one photo removed, or the
 * whole draft discarded — the picker used to keep pointing at an id no
 * option carried any more. No DOM in these tests, so the agreements are
 * checked in the source, as Colección's are.
 */
const at = (relative: string) => path.join(process.cwd(), relative);
const read = (relative: string) => readFileSync(at(relative), "utf8");
const office = (bundle: { office: object }) => bundle.office as Record<string, string>;

const sheetSource = read("src/components/office/gallery-work-sheet.tsx");

describe("the gallery tab", () => {
  it("renders cards and the sheet, not the old row list and add form", () => {
    const page = read("src/app/[locale]/office/gallery/page.tsx");
    expect(page).toContain("<GalleryCards");
    expect(page).not.toContain("GalleryManager");
    expect(existsSync(at("src/components/gallery-manager.tsx"))).toBe(false);
  });

  it("never asks with a browser pop-up", () => {
    for (const file of [
      "src/components/gallery-cards.tsx",
      "src/components/office/gallery-work-sheet.tsx",
      "src/components/office/gallery-sections-sheet.tsx",
    ]) {
      expect(read(file), file).not.toContain("window.confirm(");
    }
  });

  it("has no raw accent-ink checkbox left over from the old row list", () => {
    expect(read("src/components/gallery-cards.tsx")).not.toContain("accent-ink");
    expect(sheetSource).not.toContain("accent-ink");
  });
});

describe("the category picker after a pending section drops out", () => {
  it("resets to the first live section once its own option is gone", () => {
    expect(sheetSource).toContain("if (category === OTHER) return;");
    expect(sheetSource).toContain("if (options.some((option) => option.id === category)) return;");
    expect(sheetSource).toContain("setCategory(categories[0]?.id ?? OTHER);");
    expect(sheetSource).toContain("}, [options, categories, category]);");
    // Runs on the same options a stale selection has to be checked against.
    const effectAt = sheetSource.indexOf("useEffect(() => {\n    if (category === OTHER) return;");
    const optionsAt = sheetSource.indexOf("const options = [...categories, ...pendingSections];");
    expect(effectAt).toBeGreaterThan(optionsAt);
  });
});

describe("the office copy", () => {
  it("names the new-work sheet, and drops the checkbox labels the row list used", () => {
    for (const bundle of [es, en]) {
      const words = office(bundle);
      expect(words.newWorkTitle, "newWorkTitle").toBeTruthy();
      expect(words.newWorkTitle, "newWorkTitle").not.toContain("—");
      expect(words.workShownOnSite, "workShownOnSite").toBeTruthy();
      expect(words.workShownOnSite, "workShownOnSite").not.toContain("—");
      expect("hidden" in words, "hidden was the row checkbox's off-label").toBe(false);
      expect("shown" in words, "shown was the row checkbox's on-label").toBe(false);
    }
    expect(office(es).workShownOnSite).toBe("Se ve en el sitio");
  });
});
