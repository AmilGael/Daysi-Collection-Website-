import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { manualSheet } from "@/lib/manual";

/**
 * The manual is an office page, in the office's own type: it used to be a
 * separate document in a new tab with its own fonts and a dark theme, and
 * looked like it belonged to somebody else.
 */

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const page = read("src/app/[locale]/office/manual/page.tsx");
const manual = read("docs/manual-del-taller.html");

describe("the office manual page", () => {
  it("is guarded like every office page", () => {
    expect(page).toContain("await officeViewer(locale)");
  });

  it("renders the sheet inside the manual article", () => {
    expect(page).toContain('className="manual"');
    expect(page).toContain("manualSheet(");
  });

  it("is reached in the same tab from both links, never the raw route", () => {
    for (const file of ["src/components/office/help-sheet.tsx", "src/components/shopfront-cards.tsx"]) {
      const source = read(file);
      expect(source, file).toContain('href="/office/manual"');
      expect(source, file).not.toContain("/api/office/manual");
    }
  });
});

describe("the manual file", () => {
  it("brings no fonts, no styles and no dark theme of its own", () => {
    expect(manual).not.toContain("fonts.googleapis.com");
    expect(manual).not.toContain("<style");
    expect(manual).not.toContain("prefers-color-scheme");
  });

  it("gives the page only its sheet, whole", () => {
    const sheet = manualSheet(manual);
    expect(sheet).not.toBeNull();
    expect(sheet).toMatch(/^<header class="masthead">/);
    expect(sheet).toContain('id="problemas"');
    expect(sheet).toContain('<section class="closing">');
    expect(sheet).not.toContain("<title>");
    // The notes are divs too, so every one opened inside is closed inside.
    expect(sheet!.match(/<div\b/g)?.length).toBe(sheet!.match(/<\/div>/g)?.length);
  });
});
