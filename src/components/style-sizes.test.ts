import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * A counted size with no pieces left is not on offer ready-made, so it does
 * not appear: not as a button on the garment page, not in the card's size
 * line, not under the size filter. Made to measure brings every size back,
 * since that piece is cut to the client's own measurements.
 */
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const panel = read("src/components/style-order-panel.tsx");
const card = read("src/components/style-card.tsx");
const gallery = read("src/components/collection-gallery.tsx");
const sheet = read("src/components/office/garment-sheet.tsx");

describe("a size with no pieces left", () => {
  it("is left off the garment page unless the piece is made to measure", () => {
    expect(panel).toContain("const shownSizes = customize ? style.sizes : style.sizes.filter((size) => size.count !== 0);");
    expect(panel).toContain("{shownSizes.map((offered) => {");
    expect(panel).toContain("const readyGone = !customize && shownSizes.length === 0;");
  });

  it("is left off the card's size line, which says sold out when none are left", () => {
    expect(card).toContain(".filter((size) => size.count !== 0)");
    expect(card).toContain(': tc("soldOut")');
  });

  it("does not match the size filter", () => {
    expect(gallery).toContain("size.sizeId === sizeId && size.count !== 0");
  });

  it("says in both languages that the ready pieces are gone and made to measure is still possible", () => {
    expect(es.style.readyGone).toContain("a su medida");
    expect(en.style.readyGone).toContain("made to measure");
  });
});

describe("the office's piece counts", () => {
  it("are compact boxes", () => {
    expect(sheet).toContain('className="w-16 border border-line bg-paper px-2 py-1 text-right tabular-nums');
  });
});
