import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * Telas is cards and a sheet since 18 September 2026, the same vocabulary
 * Colección and Galería were rebuilt in: a card grid, a "+" card, and a
 * sheet per swatch. The old four-boxes-per-fabric form is gone — a new
 * fabric writes one price into all four category pairs at once (decided
 * with Daysi on 14 September 2026), which a pair can still diverge from
 * later in Precios. No DOM in these tests, so the agreements are checked in
 * the source, as Colección's and Galería's are.
 */
const at = (relative: string) => path.join(process.cwd(), relative);
const read = (relative: string) => readFileSync(at(relative), "utf8");
const office = (bundle: { office: object }) => bundle.office as Record<string, string>;

const cardsSource = read("src/components/fabric-manager.tsx");
const sheetSource = read("src/components/office/fabric-sheet.tsx");
const draftSource = read("src/components/office/fabric-draft.ts");

describe("the fabrics tab", () => {
  it("renders cards and the sheet", () => {
    const page = read("src/app/[locale]/office/fabrics/page.tsx");
    expect(page).toContain("<FabricManager");
    expect(page).not.toContain("categories=");
  });

  it("never asks with a browser pop-up", () => {
    expect(cardsSource).not.toContain("window.confirm(");
    expect(sheetSource).not.toContain("window.confirm(");
  });

  it("has no raw accent-ink checkbox", () => {
    expect(cardsSource).not.toContain("accent-ink");
    expect(sheetSource).not.toContain("accent-ink");
  });

  it("opens a sheet from a card, and a new one from the + card", () => {
    expect(cardsSource).toContain("<Sheet open={open !== null}");
    expect(cardsSource).toContain('setOpen("new")');
    expect(cardsSource).toContain("<FabricSheet row={opened}");
    expect(cardsSource).toContain("<NewFabricSheet onDone={close}");
  });

  it("keeps Retirar and Retirados, and only a custom fabric gets Retirar", () => {
    expect(sheetSource).toContain("row.custom ? (");
    expect(sheetSource).toContain("<RetireButton");
    expect(cardsSource).toContain("<RetiredGroup");
  });
});

describe("the one price the new-fabric sheet writes", () => {
  it("builds the wire through fabricAddWire rather than assembling it inline", () => {
    expect(sheetSource).toContain("fabricAddWire(key, name.trim(), \"\", averageColor, cents)");
    expect(sheetSource).not.toContain("dresses:");
  });

  it("writes the same figure into every one of the four category pairs", () => {
    expect(draftSource).toContain("prices: Object.fromEntries(");
    expect(draftSource).toContain("FABRIC_CATEGORIES.map((category) => [category, cents])");
  });

  it("stays inside the range the old four boxes enforced", () => {
    expect(sheetSource).toContain("const MIN_CENTS = 100;");
    expect(sheetSource).toContain("const MAX_CENTS = 500_000;");
  });
});

describe("the existing fabric's price on the sheet", () => {
  it("is read-only, and points at Precios for a per-pair change", () => {
    expect(sheetSource).toContain('t("fabricPriceHint")');
    // Displayed as a plain figure, not a box that could be typed into.
    expect(sheetSource.indexOf("representativePrice(row.prices)")).toBeGreaterThan(-1);
    expect(sheetSource).not.toMatch(/<MoneyBox[^>]*disabled/);
  });

  it("says 'from' the lowest pair when a fabric's categories do not share one price", () => {
    expect(sheetSource).toContain("price.varies");
    expect(cardsSource).toContain("price.varies");
  });
});

describe("the office copy", () => {
  it("names the new-fabric sheet and the one price box, in both languages", () => {
    for (const bundle of [es, en]) {
      const words = office(bundle);
      for (const key of [
        "newFabricTitle", "fabricPrice", "fabricPriceHint", "fabricPriceFrom",
        "fabricAdd", "fabricName", "fabricNamePlaceholder", "fabricSwatch",
        "fabricSave", "fabricYours", "fabricNote", "fabricsTitle", "fabricsLead",
      ]) {
        expect(words[key], key).toBeTruthy();
        expect(words[key], key).not.toContain("—");
      }
      expect("fabricPrices" in words, "fabricPrices was the four-box legend").toBe(false);
    }
    expect(office(es).fabricPrice).toBe("Precio");
    expect(office(es).newFabricTitle).toBe("Un rollo nuevo");
  });

  it("no longer promises that a blank category is left unpriced", () => {
    for (const bundle of [es, en]) {
      expect(office(bundle).fabricsLead).not.toMatch(/blank|en blanco/);
    }
  });
});
