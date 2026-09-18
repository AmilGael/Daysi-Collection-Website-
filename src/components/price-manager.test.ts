import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * Precios is rows and sheets since 18 September 2026, the same vocabulary
 * Colección, Galería and Telas were rebuilt in: garment prices grouped by
 * category behind a collapsible header, and Arreglos/Sesiones as rows of
 * their own. Tapping a row opens a sheet with the money boxes for that one
 * row — a phone tap into the old table of thirty inputs dropped the cursor
 * mid-number, since editing happened in place. Task 9's "+ Agregar un
 * arreglo" / "+ Agregar una sesión" and their add sheets (service-sheet.tsx)
 * are reused untouched. No DOM in these tests, so the agreements are
 * checked in the source, as the other rebuilt tabs' are.
 */
const at = (relative: string) => path.join(process.cwd(), relative);
const read = (relative: string) => readFileSync(at(relative), "utf8");
const office = (bundle: { office: object }) => bundle.office as Record<string, string>;

const rowsSource = read("src/components/price-manager.tsx");
const sheetSource = read("src/components/office/price-sheet.tsx");
const draftSource = read("src/components/office/price-draft.ts");
const addSheetSource = read("src/components/office/service-sheet.tsx");
const pageSource = read("src/app/[locale]/office/prices/page.tsx");

describe("the prices tab", () => {
  it("renders rows and a sheet, not a table of inputs", () => {
    expect(pageSource).toContain("<PriceManager");
    expect(rowsSource).not.toContain("<PriceTable");
    expect(rowsSource).not.toContain('type="number"');
    expect(rowsSource).not.toContain('inputMode="decimal"');
  });

  it("never asks with a browser pop-up", () => {
    expect(rowsSource).not.toContain("window.confirm(");
    expect(sheetSource).not.toContain("window.confirm(");
  });

  it("has no raw accent-ink checkbox", () => {
    expect(rowsSource).not.toContain("accent-ink");
    expect(sheetSource).not.toContain("accent-ink");
  });

  it("opens one sheet from a garment, alteration or session row", () => {
    expect(rowsSource).toContain('onOpen={() => setOpen({ kind: "entry", id: entry.id })}');
    expect(rowsSource).toContain('onOpen={() => setOpen({ kind: "alteration", id: alteration.id })}');
    expect(rowsSource).toContain('onOpen={() => setOpen({ kind: "appointment", id: appointment.id })}');
    expect(rowsSource).toContain("<Sheet open={open !== null} title={title} onClose={close}>");
    expect(rowsSource).toContain("<EntryPriceSheet row={openedEntry} />");
    expect(rowsSource).toContain("<AlterationPriceSheet row={openedAlteration} />");
    expect(rowsSource).toContain("<AppointmentPriceSheet row={openedAppointment} />");
  });

  it("keeps Retirados at the bottom", () => {
    expect(rowsSource).toContain("<RetiredGroup");
    expect(rowsSource).toContain('restorable("entry", "price-entry", entry.id,');
    expect(rowsSource).toContain('restorable("alteration", "alteration", alteration.id,');
    expect(rowsSource).toContain('restorable("appointment", "appointment-type", appointment.id,');
  });
});

describe("garment prices grouped by category", () => {
  it("groups active entries by category, in the site's category order, before they reach the tab", () => {
    expect(pageSource).toContain("const priceGroups: PriceCategoryGroup[] = categories");
    expect(pageSource).toContain("entries: activePriceEntries.filter((entry) => entry.categoryId === category.id)");
    expect(pageSource).toContain(".filter((group) => group.entries.length > 0);");
    // categoryId and the fabric's swatch travel with the entry so the row and the group both have what they need.
    expect(pageSource).toContain("categoryId: entry.categoryId,");
    expect(pageSource).toContain("fabricSwatch: fabrics.find((fabric) => fabric.id === entry.fabricId)?.swatchImage ?? \"\",");
  });

  it("is a button header that names the category and a count, and opens by itself", () => {
    expect(rowsSource).toContain("function CategoryGroup(");
    expect(rowsSource).toContain('<details className="group border-t border-line" open>');
    expect(rowsSource).toContain("group-open:rotate-180");
    expect(rowsSource).toContain("{count}");
  });

  it("shows the fabric swatch, its name, the price, the made-to-measure extra, and the own-priced note", () => {
    expect(rowsSource).toContain("swatch={entry.fabricSwatch}");
    expect(rowsSource).toContain("title={entry.fabric}");
    expect(rowsSource).toContain('note={entry.ownPriced > 0 ? t("entryOwnPriced", { count: entry.ownPriced }) : undefined}');
    expect(rowsSource).toContain('`${t("pricesPrice")} ${formatMoney(entry.fixedPrice, locale)}`');
    expect(rowsSource).toContain('`${t("pricesExtra")} ${formatMoney(entry.customizationExtra, locale)}`');
  });
});

describe("editing one row's money at a time", () => {
  it("reuses the same decimal MoneyBox the rest of the office uses", () => {
    expect(sheetSource).toContain('import { MoneyBox } from "./garment-sheet";');
    expect(sheetSource).toContain('import { inBox } from "./garment-draft";');
    expect(sheetSource).toContain("centsFromInput");
    expect(sheetSource).not.toContain("parseFloat(");
  });

  it("stages the same entry, alteration and appointment changes the table staged, by the same keys", () => {
    expect(draftSource).toContain('export const entryKey = (id: string): string => `entry:${id}`;');
    expect(draftSource).toContain('export const alterationKey = (id: string): string => `alteration:${id}`;');
    expect(draftSource).toContain('export const appointmentKey = (id: string): string => `appointment:${id}`;');
    expect(sheetSource).toContain('{ type: "entry", key, id: row.id, fixedPrice: priceCents, customizationExtra: extraCents }');
    expect(sheetSource).toContain('{ type: "alteration", key, id: row.id, fixedPrice: priceCents, rushSurcharge: rushCents }');
    expect(sheetSource).toContain('{ type: "appointment", key, id: row.id, fee: cents }');
  });

  it("never stages a value that is not a valid amount", () => {
    expect(sheetSource).toContain("const MAX_CENTS = 500_000;");
    expect(sheetSource).toContain("if (priceCents === null || extraCents === null || priceCents > MAX_CENTS || extraCents > MAX_CENTS) return;");
    expect(sheetSource).toContain("if (priceCents === null || rushCents === null || priceCents > MAX_CENTS || rushCents > MAX_CENTS) return;");
    expect(sheetSource).toContain("if (cents === null || cents > MAX_CENTS) return;");
  });

  it("commits one row's values only, read back from that row's own pending change", () => {
    expect(sheetSource).toContain('const fixedPrice = wire?.type === "entry" ? wire.fixedPrice : row.fixedPrice;');
    expect(sheetSource).toContain('const fixedPrice = wire?.type === "alteration" ? wire.fixedPrice : row.fixedPrice;');
    expect(sheetSource).toContain('const fee = wire?.type === "appointment" ? wire.fee : row.fee;');
  });
});

describe("Retirar and Deshacer on a row's sheet", () => {
  it("offers Retirar on every garment price, and only on an alteration or session Daysi added", () => {
    expect(sheetSource).toContain('{ type: "retire", key, id: row.id, kind: "price-entry" }');
    expect(sheetSource).toContain("{!row.coded ? (");
    expect(sheetSource).toContain('{ type: "retire", key, id: row.id, kind: "alteration" }');
    expect(sheetSource).toContain('{ type: "retire", key, id: row.id, kind: "appointment-type" }');
  });

  it("hides Deshacer while a change on that row is already pending", () => {
    expect(sheetSource).toContain('row.undoable && !pending ? <UndoLink kind="price-entry" id={row.id} />');
    expect(sheetSource).toContain('row.undoable && !pending ? <UndoLink kind="alteration" id={row.id} />');
    expect(sheetSource).toContain('row.undoable && !pending ? <UndoLink kind="appointment" id={row.id} />');
  });
});

describe("adding an alteration or a session", () => {
  it("puts a + row under Arreglos and Sesiones that opens Task 9's add sheet", () => {
    expect(rowsSource).toContain('<AddRow label={t("pricesAddAlteration")} onAdd={() => setOpen("add-alteration")} />');
    expect(rowsSource).toContain('<AddRow label={t("pricesAddSession")} onAdd={() => setOpen("add-session")} />');
    expect(rowsSource).toContain('<NewAlterationSheet onDone={close} />');
    expect(rowsSource).toContain('<NewSessionSheet onDone={close} />');
    expect(rowsSource).toContain('import { NewAlterationSheet, NewSessionSheet } from "./office/service-sheet";');
  });

  it("still stages each add with a key of its own, the photo uploaded at confirm, untouched by this pass", () => {
    expect(addSheetSource).toContain("`alteration-add:${crypto.randomUUID()}`");
    expect(addSheetSource).toContain("`appointment-add:${crypto.randomUUID()}`");
    expect(addSheetSource).toContain("files: [photo.file], withUploads");
    expect(addSheetSource).toContain('import { MoneyBox } from "./garment-sheet";');
  });

  it("shows what she added as a row, pending, until she confirms", () => {
    expect(rowsSource).toContain('if (wire.type === "alteration-add") {');
    expect(rowsSource).toContain('if (wire.type === "appointment-add") {');
    expect(rowsSource).toContain("function PendingAddRow(");
  });
});

describe("the office copy", () => {
  it("still names every label this tab shows, in both languages", () => {
    for (const bundle of [es, en]) {
      const words = office(bundle);
      for (const key of [
        "pricesGarments", "pricesAlterations", "pricesSessions", "pricesPrice", "pricesExtra",
        "pricesRush", "pricesFee", "entryOwnPriced", "pricesAddAlteration", "pricesAddSession",
        "newAlterationTitle", "newSessionTitle",
      ]) {
        expect(words[key], key).toBeTruthy();
        expect(words[key], key).not.toContain("—");
      }
    }
  });
});
