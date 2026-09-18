import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * Vitrina is four cards and a sheet since 18 September 2026, the same
 * vocabulary Colección, Galería, Telas and Precios were rebuilt in — except
 * there is no "+" card here: each of the four names one fixed feature
 * (Aviso, Promociones, Asistente para clientes, Código QR) rather than a
 * list of like items. The first, second and fourth open a sheet; the third
 * carries Task 17's own Switch right on its face, since there is nothing
 * else to it. Promotion rows keep Task 13's list, add form and Retirados
 * inside that sheet, unchanged in behaviour. No DOM in these tests, so the
 * agreements are checked in the source, as the other rebuilt tabs' are.
 */
const at = (relative: string) => path.join(process.cwd(), relative);
const read = (relative: string) => readFileSync(at(relative), "utf8");
const office = (bundle: { office: object }) => bundle.office as Record<string, string>;

const cardsSource = read("src/components/shopfront-cards.tsx");
const noticeSource = read("src/components/notice-editor.tsx");
const promoSource = read("src/components/promotion-editor.tsx");
const draftSource = read("src/components/office/shopfront-draft.ts");
const pageSource = read("src/app/[locale]/office/shopfront/page.tsx");

describe("the shopfront tab", () => {
  it("renders the four cards from the page, not the four sections the tab used to lay out itself", () => {
    expect(pageSource).toContain("<ShopfrontCards");
    expect(pageSource).not.toContain("<NoticeEditor");
    expect(pageSource).not.toContain("<PromotionEditor");
    expect(pageSource).not.toContain("<HelperSwitch");
  });

  it("never asks with a browser pop-up", () => {
    expect(cardsSource).not.toContain("window.confirm(");
    expect(noticeSource).not.toContain("window.confirm(");
    expect(promoSource).not.toContain("window.confirm(");
  });

  it("has no raw accent-ink checkbox left over from the old notice box", () => {
    expect(cardsSource).not.toContain("accent-ink");
    expect(noticeSource).not.toContain("accent-ink");
    expect(noticeSource).not.toContain('type="checkbox"');
  });

  it("opens one sheet from the Aviso, Promociones or QR card", () => {
    expect(cardsSource).toContain('setOpen("notice")');
    expect(cardsSource).toContain('setOpen("promotions")');
    expect(cardsSource).toContain('setOpen("qr")');
    expect(cardsSource).toContain("<Sheet open={open !== null} title={title} onClose={close}>");
    expect(cardsSource).toContain("<NoticeEditor initialMessage={notice.message}");
    expect(cardsSource).toContain("<PromotionEditor");
  });

  it("lets the Asistente card's own switch act where it sits, with no sheet of its own", () => {
    expect(cardsSource).toContain("<HelperSwitch initialVisible={helperInitialVisible}");
    expect(cardsSource).not.toContain('setOpen("helper")');
  });

  it("links to the manual under the grid, opened in a new tab, as the help sheet does", () => {
    expect(cardsSource).toContain('href="/api/office/manual"');
    expect(cardsSource).toContain('target="_blank"');
    expect(cardsSource).toContain('{t("helpOpenManual")}');
  });

  it("keeps the tab inside one draft provider", () => {
    const open = pageSource.indexOf("<OfficeDraftProvider");
    const close = pageSource.indexOf("</OfficeDraftProvider>");
    expect(open).toBeGreaterThan(-1);
    expect(open).toBeLessThan(pageSource.indexOf("<section"));
    expect(close).toBeGreaterThan(pageSource.lastIndexOf("</section>"));
  });
});

describe("the notice sheet's switch", () => {
  it("replaced the raw checkbox with the shared Switch, staying on the shared notice key", () => {
    expect(noticeSource).toContain('import { NOTICE_KEY } from "./office/shopfront-draft";');
    expect(noticeSource).toContain("import { Switch } from \"./office/switch\";");
    expect(noticeSource).toContain("<Switch");
    expect(noticeSource).toContain('label={t("noticeVisible")}');
  });
});

describe("the promotions sheet", () => {
  it("imports its key, wire and date format from shopfront-draft rather than defining them again", () => {
    expect(promoSource).toContain("promotionKeyFor,\n  promotionWireOf,\n  scopeFromChoice,");
    expect(promoSource).not.toContain("const keyFor = (id: string)");
    expect(promoSource).not.toContain("function wireOf(");
    expect(promoSource).not.toContain("function scopeFromChoice(");
  });

  it("still keeps the add form, Retirar/Deshacer and Retirados exactly as Task 13 built them", () => {
    // The add form opens through its own local state, nested inside whichever
    // sheet this list itself is rendered in — not the cards' own `open`.
    expect(promoSource).toContain("const [adding, setAdding] = useState(false);");
    expect(promoSource).toContain("<RetiredGroup");
    expect(promoSource).toContain("<RetireButton");
    expect(promoSource).toContain('promotion.undoable ? <UndoLink kind="promotion" id={promotion.id} /> : null');
  });
});

describe("the Promociones card's summary", () => {
  it("counts a promotion active from its own pending switch, never one pending a retire", () => {
    expect(cardsSource).toContain('if (wire?.type === "retire") return [];');
    expect(cardsSource).toContain('const active = wire?.type === "promotion" ? wire.active : promotion.active;');
  });

  it("reads the soonest end date only from the promotions the card already knows are active", () => {
    // soonestEnding trusts its caller's filtering rather than re-checking `active` itself,
    // so a switch staged but not yet confirmed is judged the same way the count already judged it.
    expect(draftSource).toContain("export function soonestEnding<P extends Pick<Promotion, \"endsAt\">>(");
    expect(draftSource).not.toContain("!promotion.active");
    expect(cardsSource).toContain("soonestEnding(activePromotions, today)");
  });
});

describe("the Aviso card", () => {
  it("shows the current text or the empty state, and an on/off chip", () => {
    expect(cardsSource).toContain("noticeMessage || t(\"noticeEmpty\")");
    expect(cardsSource).toContain('{noticeVisible ? t("noticeOnChip") : t("noticeOffChip")}');
  });

  it("reflects a pending edit before it is confirmed, rather than only the saved notice", () => {
    expect(cardsSource).toContain('noticeWire?.type === "notice" ? noticeWire.message : notice.message');
    expect(cardsSource).toContain('noticeWire?.type === "notice" ? noticeWire.visible : notice.visible');
  });
});

describe("the QR card and sheet", () => {
  it("takes both sizes as already-rendered server elements, not by importing SiteQrCode itself", () => {
    expect(cardsSource).not.toContain("SiteQrCode");
    expect(cardsSource).toContain("qrThumbnail");
    expect(cardsSource).toContain("qrFull");
    expect(pageSource).toContain("qrThumbnail={<SiteQrCode size={72} />}");
    expect(pageSource).toContain("qrFull={<SiteQrCode size={220} />}");
  });
});

describe("the office copy", () => {
  it("names every label the new cards show, in both languages", () => {
    for (const bundle of [es, en]) {
      const words = office(bundle);
      for (const key of ["noticeEmpty", "noticeOnChip", "noticeOffChip", "promoActiveCount"]) {
        expect(words[key], key).toBeTruthy();
        expect(words[key], key).not.toContain("—");
      }
    }
    expect(office(es).noticeEmpty).toBe("Sin aviso");
  });

  it("no longer tells her to (un)check a box that is a switch now", () => {
    for (const bundle of [es, en]) {
      const lead = office(bundle).noticeLead;
      expect(lead).not.toMatch(/casilla|check.*box/i);
    }
  });
});
