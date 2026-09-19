import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MoneyBox (garment-sheet.tsx) is the one decimal money input the whole
 * office shares: Colección's own-price boxes, Telas' new-fabric price,
 * Task 9's add-an-alteration/add-a-session sheets, and Precios' row
 * sheets (price-sheet.tsx) all render through it rather than each rolling
 * their own. It exists because a `type="number"` box let the tap that
 * focused it land the caret after focus fired — typing "1" into "195.00"
 * produced "1915.00" on a phone. Pinned here, once, on the shared
 * component itself, so a change to garment-sheet.tsx can't silently drop
 * the fix for every tab that reuses it (the price-manager rewrite for
 * Task 15c moved Precios' money editing into MoneyBox and, in doing so,
 * deleted the only test that had pinned this markup, which lived beside
 * the old inline table).
 */
const source = readFileSync(path.join(process.cwd(), "src/components/office/garment-sheet.tsx"), "utf8");
const start = source.indexOf("export function MoneyBox(");
const moneyBox = source.slice(start, source.indexOf("/**", start));

describe("MoneyBox, the office's one decimal money input", () => {
  it("was found in garment-sheet.tsx", () => {
    expect(start).toBeGreaterThan(-1);
    expect(moneyBox.length).toBeGreaterThan(0);
  });

  it("is a decimal text field, not a number input", () => {
    expect(moneyBox).not.toContain('type="number"');
    expect(moneyBox).toContain('inputMode="decimal"');
  });

  it("selects the whole value on focus, a frame late so the tap that focused it does not put the caret back", () => {
    expect(moneyBox).toContain("const box = event.currentTarget;");
    expect(moneyBox).toContain("requestAnimationFrame(() => box.select());");
  });

  it("is tall enough to tap", () => {
    expect(moneyBox).toContain("min-h-11");
  });
});

describe("who still renders their money through MoneyBox", () => {
  it("Precios' row sheets", () => {
    const priceSheet = readFileSync(path.join(process.cwd(), "src/components/office/price-sheet.tsx"), "utf8");
    expect(priceSheet).toContain('import { MoneyBox } from "./garment-sheet";');
  });

  it("Task 9's add-an-alteration and add-a-session sheets", () => {
    const serviceSheet = readFileSync(path.join(process.cwd(), "src/components/office/service-sheet.tsx"), "utf8");
    expect(serviceSheet).toContain('import { MoneyBox } from "./garment-sheet";');
  });
});
