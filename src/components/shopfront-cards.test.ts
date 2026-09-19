import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * Vitrina is four cards and a sheet since 18 September 2026, the same
 * vocabulary Colección, Galería, Telas and Precios were rebuilt in, except
 * there is no "+" card here: each of the four names one fixed feature
 * (Anuncios, Promociones, Asistente para clientes, Código QR) rather than a
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
const announcementSource = read("src/components/announcement-editor.tsx");
const promoSource = read("src/components/promotion-editor.tsx");
const draftSource = read("src/components/office/shopfront-draft.ts");
const pageSource = read("src/app/[locale]/office/shopfront/page.tsx");

describe("the shopfront tab", () => {
  it("renders the four cards from the page, not the four sections the tab used to lay out itself", () => {
    expect(pageSource).toContain("<ShopfrontCards");
    expect(pageSource).not.toContain("<AnnouncementEditor");
    expect(pageSource).not.toContain("<PromotionEditor");
    expect(pageSource).not.toContain("<HelperSwitch");
  });

  it("never asks with a browser pop-up", () => {
    expect(cardsSource).not.toContain("window.confirm(");
    expect(announcementSource).not.toContain("window.confirm(");
    expect(promoSource).not.toContain("window.confirm(");
  });

  it("has no raw accent-ink checkbox, the pages being pressed buttons and every on/off a Switch", () => {
    expect(cardsSource).not.toContain("accent-ink");
    expect(announcementSource).not.toContain("accent-ink");
    expect(announcementSource).not.toContain('type="checkbox"');
    expect(announcementSource).toContain("aria-pressed={on}");
  });

  it("opens one sheet from the Anuncios, Promociones or QR card", () => {
    expect(cardsSource).toContain('setOpen("announcements")');
    expect(cardsSource).toContain('setOpen("promotions")');
    expect(cardsSource).toContain('setOpen("qr")');
    expect(cardsSource).toContain("<Sheet open={open !== null} title={title} onClose={close}>");
    expect(cardsSource).toContain("<AnnouncementEditor announcements={announcements} retired={retiredAnnouncements} />");
    expect(cardsSource).toContain("<PromotionEditor");
  });

  it("lets the Asistente card's own switch act where it sits, with no sheet of its own", () => {
    expect(cardsSource).toContain("<HelperSwitch initialVisible={helperInitialVisible}");
    expect(cardsSource).not.toContain('setOpen("helper")');
  });

  it("links to the manual under the grid, in the office and in the same tab, as the help sheet does", () => {
    expect(cardsSource).toContain('<Link href="/office/manual"');
    expect(cardsSource).not.toContain("/api/office/manual");
    expect(cardsSource).not.toContain('target="_blank"');
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

describe("the announcements sheet", () => {
  it("keeps its key and wire in shopfront-draft, beside the promotions'", () => {
    expect(draftSource).toContain("export function announcementKeyFor(id: string): string {");
    expect(draftSource).toContain("export function announcementWireOf(");
    expect(announcementSource).toContain("announcementKeyFor, announcementWireOf, type ManagedAnnouncement");
  });

  it("swaps the list for the form in place, with no second Sheet, like the promotions", () => {
    expect(announcementSource).not.toContain("<Sheet");
    expect(announcementSource).toContain("if (editing) {");
    expect(announcementSource).toContain("onDone={backToList}");
  });

  it("retires and restores as an announcement, never as a promotion", () => {
    expect(announcementSource).toContain('{ type: "retire", key, id: announcement.id, kind: "announcement" }');
    expect(announcementSource).toContain('{ type: "restore", key: announcementKeyFor(id), id, kind: "announcement" }');
    expect(announcementSource).toContain('<UndoLink kind="announcement" id={announcement.id} />');
  });

  it("refuses to stage one with no words, or with no page and Todas off", () => {
    expect(announcementSource).toContain('if (words.length === 0) return setProblem(t("annMessageRequired"));');
    expect(announcementSource).toContain('if (!everyPage && pages.length === 0) return setProblem(t("annPagesRequired"));');
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
    expect(promoSource).toContain("const [adding, setAdding] = useState(false);");
    expect(promoSource).toContain("<RetiredGroup");
    expect(promoSource).toContain("<RetireButton");
    expect(promoSource).toContain('promotion.undoable ? <UndoLink kind="promotion" id={promotion.id} /> : null');
  });

  it("keeps the 90% rule, the amount cap and the date-order check, and stages the same wire, untouched", () => {
    expect(promoSource).toContain("if (value < 1 || value > MOST_PERCENT) return setProblem(t(\"promoPercentRange\"));");
    expect(promoSource).toContain("if (cents === null || cents < LEAST_AMOUNT || cents > MOST_AMOUNT) return setProblem(t(\"promoAmountRange\"));");
    expect(promoSource).toContain("if (startsAt && endsAt && endsAt < startsAt) return setProblem(t(\"promoDatesOrder\"));");
    expect(promoSource).toContain('scope: scopeFromChoice(scope),');
  });

  it("swaps the list for the add form in place, with no second Sheet nested inside the outer one", () => {
    // A second Sheet would register its own Escape and popstate handlers on
    // top of the outer one's (sheet.tsx), so Escape or a phone swipe-back
    // while adding a promotion would close both and drop her back to the
    // four cards — see the review finding on shopfront-cards.tsx.
    expect(promoSource).not.toContain("<Sheet");
    expect(promoSource).not.toContain('from "./office/sheet"');
    expect(promoSource).toContain("if (adding) {");
    expect(promoSource).toContain('onClick={backToList} className="w-fit text-[0.8125rem] underline underline-offset-4">\n          {t("promoBack")}');
    expect(promoSource).toContain("onDone={backToList}");
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

  it("only counts a promotion actually running today, reusing promotionApplies's own date logic", () => {
    expect(cardsSource).toContain('import { promotionActiveToday } from "@/lib/promotions";');
    expect(cardsSource).toContain(
      'return promotionActiveToday({ active, startsAt, endsAt }, today) ? [promotion] : [];',
    );
    // Dates come from the same staged wire the active switch already reads,
    // so an edit to the dates counts before it is confirmed too.
    expect(cardsSource).toContain(
      'const startsAt = wire?.type === "promotion" ? wire.startsAt : promotion.startsAt;',
    );
    expect(cardsSource).toContain('const endsAt = wire?.type === "promotion" ? wire.endsAt : promotion.endsAt;');
  });
});

describe("the Anuncios card", () => {
  it("shows the first one on the site, or why there is none, and how many are on", () => {
    expect(cardsSource).toContain('announcementsShowing[0] ?? (announcements.length === 0 ? t("annEmpty") : t("annNoneShowing"))');
    expect(cardsSource).toContain('t("annShowingCount", { count: announcementsShowing.length })');
  });

  it("counts from a pending edit or retire before it is confirmed", () => {
    expect(cardsSource).toContain('const wire = draft.pending(announcementKeyFor(announcement.id))?.change.wire;');
    expect(cardsSource).toContain('const visible = wire?.type === "announcement" ? wire.visible : announcement.visible;');
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
      for (const key of ["annTitle", "annLead", "annEmpty", "annNoneShowing", "annShowingCount", "annAllPages", "promoActiveCount", "promoBack"]) {
        expect(words[key], key).toBeTruthy();
        expect(words[key], key).not.toMatch(/[\u2013\u2014]/);
      }
    }
    expect(office(es).annTitle).toBe("Anuncios");
    expect(office(es).promoBack).toBe("Volver");
  });

  it("names every page an announcement can go on, in both languages", async () => {
    const { ANNOUNCEMENT_PAGES } = await import("@/lib/announcement-pages");
    for (const bundle of [es, en]) {
      const pages = (bundle.office as unknown as { annPage: Record<string, string> }).annPage;
      for (const page of ANNOUNCEMENT_PAGES) expect(pages[page.id], page.id).toBeTruthy();
    }
  });
});
