import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * Colección is cards and a sheet since 15 September 2026. The old row
 * editor and the add form are gone, nothing asks with a browser pop-up any
 * more, and the sheet's words exist in both languages. No DOM here, so the
 * agreements are read from the source, as the tab strip's are.
 */
const at = (relative: string) => path.join(process.cwd(), relative);
const read = (relative: string) => readFileSync(at(relative), "utf8");
const office = (bundle: { office: object }) => bundle.office as Record<string, string>;

describe("the collection tab", () => {
  it("renders cards and the sheet, not the old editor and form", () => {
    const page = read("src/app/[locale]/office/collection/page.tsx");
    expect(page).toContain("<CollectionCards");
    expect(page).not.toContain("CollectionManager");
    expect(page).not.toContain("StyleComposer");
    expect(existsSync(at("src/components/collection-manager.tsx"))).toBe(false);
    expect(existsSync(at("src/components/style-composer.tsx"))).toBe(false);
  });

  it("never asks with a browser pop-up", () => {
    for (const file of [
      "src/components/collection-cards.tsx",
      "src/components/office/garment-sheet.tsx",
      "src/components/office/garment-photos.tsx",
      "src/components/office/garment-words.tsx",
    ]) {
      expect(read(file), file).not.toContain("window.confirm(");
    }
  });

  it("types Spanish only on the create sheet and stages one style-create", () => {
    const sheet = read("src/components/office/garment-sheet.tsx");
    expect(sheet).toContain('type: "style-create"');
    expect(sheet).not.toContain("nameEn");
    expect(sheet).toContain("inStudio");
  });

  it("has the sheet's words in both languages, and not the pop-up's", () => {
    for (const bundle of [es, en]) {
      const words = office(bundle);
      for (const key of [
        "addGarment", "newGarmentTitle", "photosTitle", "photoCoverMark", "photoMakeCover",
        "photoEarlier", "photoLater", "photoRemove", "photoAdd", "photoUploadsOnConfirm",
        "wordsTitle", "seeEnglish", "hideEnglish", "englishPending", "translateNow",
        "correctEnglish", "sizesTitle", "shownOnSite", "inStudio", "hiddenChip", "studioChip",
        "priceUnknown", "dropChanges",
      ]) {
        expect(words[key], key).toBeTruthy();
        expect(words[key], key).not.toContain("—");
      }
      expect("photoCoverAsk" in words).toBe(false);
      expect("addPhoto" in words).toBe(false);
    }
    expect(office(es).inStudio).toBe("Se ofrece en el estudio");
    expect(office(es).seeEnglish).toBe("Ver inglés");
  });
});

describe("a garment's own price", () => {
  it("is a switch on both sheets, beside the list price", () => {
    const sheet = read("src/components/office/garment-sheet.tsx");
    expect(sheet.match(/t\("ownPriceSwitch"\)/g)).toHaveLength(2);
    expect(sheet.match(/t\("ownPriceNote"\)/g)).toHaveLength(2);
    expect(sheet).toContain('t("stylePriceFromList")');
  });

  it("is counted on its entry's row in Precios", () => {
    expect(read("src/components/price-manager.tsx")).toContain('t("entryOwnPriced", { count: entry.ownPriced })');
  });

  it("has its words in both languages", () => {
    for (const bundle of [es, en]) {
      for (const key of ["ownPriceSwitch", "ownPriceNote", "ownPriceRequired", "entryOwnPriced"]) {
        expect(office(bundle)[key], key).toBeTruthy();
        expect(office(bundle)[key], key).not.toContain("—");
      }
    }
    expect(office(es).ownPriceSwitch).toBe("Precio propio para esta prenda");
    expect(office(es).ownPriceNote).toBe("Solo esta prenda. La lista de precios no cambia.");
    expect(office(es).entryOwnPriced).toBe(
      "{count, plural, one {# prenda con precio propio} other {# prendas con precio propio}}",
    );
  });

  it("reaches the public cards and garment page through the live price, never the coded list", () => {
    const card = read("src/components/style-card.tsx");
    expect(card).toContain("style: PricedStyle");
    expect(card).not.toContain("findPriceEntry");
    // Rendered inside client components: nothing that reads the data files.
    expect(card).not.toContain("@/lib/live-");
    expect(read("src/components/collection-gallery.tsx")).not.toContain("@/lib/live-");

    const page = read("src/app/[locale]/collection/[slug]/page.tsx");
    expect(page).toContain("const price = priceFor(style);");
    expect(page).not.toContain("findPriceEntry");
    for (const reader of [
      "src/app/[locale]/collection/page.tsx",
      "src/app/[locale]/page.tsx",
      "src/app/[locale]/premieres/page.tsx",
      "src/app/[locale]/collection/[slug]/page.tsx",
    ]) {
      expect(read(reader), reader).toContain("withPrices(");
    }
  });
});
