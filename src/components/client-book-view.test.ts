import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * Clientes on a phone, from the 2026-09-19 visual pass. No DOM in these
 * tests, so what the page does is checked in the source, as the other
 * office sheets are.
 */
const read = (file: string) => readFileSync(path.join(process.cwd(), "src/components", file), "utf8");
const view = read("client-book-view.tsx");
const sheet = read("office/sheet.tsx");
const parts = read("office/client-sheet-parts.tsx");

describe("opening a client", () => {
  /**
   * The sheet focuses its first box when it opens, which on a phone raises
   * the keyboard over half the sheet. For a client already in the book she
   * came to read, so only Añadir cliente starts in the Name box.
   */
  it("starts in the Name box only for a new client", () => {
    expect(view).toContain("focusContent={openedRow !== undefined && isNewKey(openedRow.key)}");
  });

  it("lets a sheet open on Listo instead of its first box", () => {
    expect(sheet).toContain("focusContent = true,");
    expect(sheet).toContain(
      "const first = focusContent\n      ? content.current?.querySelector<HTMLElement>('input:not([type=\"file\"]), textarea, select, button')\n      : null;",
    );
    expect(sheet).toContain('(first ?? panel.current?.querySelector<HTMLElement>("button"))?.focus();');
  });
});

describe("the Clientes search", () => {
  /** "Buscar por nombre, teléfono o" was all a 375 px phone showed of the old placeholder. */
  it("has a placeholder short enough for a phone, and a label that says what it searches", () => {
    for (const { office } of [es, en]) {
      expect(office.clientsSearch.length).toBeLessThanOrEqual(25);
      expect(office.clientsSearchLabel.length).toBeGreaterThan(office.clientsSearch.length);
      expect(office.clientsSearch).not.toMatch(/[—–]/);
      expect(office.clientsSearchLabel).not.toMatch(/[—–]/);
    }
    expect(view).toContain('placeholder={t("clientsSearch")}');
    expect(view).toContain('label={t("clientsSearchLabel")}');
  });
});

describe("a measurement row in a client's sheet", () => {
  /**
   * Quitar was 36 px tall. It is 44 now, pulled into the row's gap and
   * padding by a negative margin so the row keeps the height it had.
   */
  it("gives Quitar a 44 px tap target without growing the row", () => {
    const remove = parts.slice(parts.indexOf("onClick={() => onRemove(!removed)}"), parts.indexOf('t("clientRemove")'));
    expect(remove).toContain("min-h-11");
    expect(remove).toContain("-my-1");
    expect(remove).not.toContain("min-h-9");
  });
});
