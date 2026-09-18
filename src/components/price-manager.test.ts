import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * On a phone a tap into a number box landed the cursor mid-number, so typing
 * 1 into 195.00 produced 1915.00. The box is a decimal text field now: the
 * phone shows a number pad, a tap selects the whole value, and what she
 * types goes through centsFromInput, which also accepts a comma.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/price-manager.tsx"), "utf8");

describe("the price boxes", () => {
  it("are decimal text fields, not number inputs", () => {
    expect(source).not.toContain('type="number"');
    expect(source).toContain('inputMode="decimal"');
  });

  it("select the whole value on focus and parse through centsFromInput", () => {
    expect(source).toContain("requestAnimationFrame(() => box.select());");
    expect(source).toContain("const box = event.currentTarget;");
    expect(source).toContain('import { centsFromInput } from "@/lib/money";');
    expect(source).toContain("next.map(centsFromInput)");
    expect(source).not.toContain("parseFloat(");
  });

  it("are tall enough to tap", () => {
    expect(source).toContain("min-h-11");
  });
});

/**
 * Daysi can add an alteration or a session from Precios, not only reprice
 * the coded ones. A "+" row under each of those tables opens a sheet; what
 * she adds is pending in its table until she confirms, and only what she
 * added carries a Retirar.
 */
const sheet = readFileSync(path.join(process.cwd(), "src/components/office/service-sheet.tsx"), "utf8");

describe("adding an alteration or a session", () => {
  it("puts a + row under Arreglos and Sesiones that opens a sheet", () => {
    expect(source).toContain('addLabel={t("pricesAddAlteration")}');
    expect(source).toContain('addLabel={t("pricesAddSession")}');
    expect(source).toContain('onAdd={() => setAdding("alteration")}');
    expect(source).toContain('onAdd={() => setAdding("session")}');
    expect(source).toContain("<Sheet open={adding !== null}");
  });

  it("offers Retirar only on what she added", () => {
    expect(source).toContain("retirable: !alteration.coded");
    expect(source).toContain("retirable: !appointment.coded");
    expect(source).toContain('{ type: "retire", key, id: row.id, kind: retireKind }');
  });

  it("stages each add with a key of its own, the photo uploaded at confirm", () => {
    expect(sheet).toContain("`alteration-add:${crypto.randomUUID()}`");
    expect(sheet).toContain("`appointment-add:${crypto.randomUUID()}`");
    expect(sheet).toContain("files: [photo.file], withUploads");
  });

  it("uses the same decimal money box as the rest of the office", () => {
    expect(sheet).toContain('import { MoneyBox } from "./garment-sheet"');
    expect(sheet).toContain("centsFromInput");
  });
});

