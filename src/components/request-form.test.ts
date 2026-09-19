import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * A client who arrives with `?kind=alteration` (or `?kind=commission`) is
 * set on that kind already: the form shows a heading, not the two-option
 * chooser, and a "Cambiar"/"Change" link back to a bare /request undoes the
 * lock. With no `?kind` (or an unknown one) the chooser still shows both
 * remaining kinds, as before Task 6. No DOM here, so this reads the source,
 * the way the collection tab's test does.
 */
const at = (relative: string) => path.join(process.cwd(), relative);
const read = (relative: string) => readFileSync(at(relative), "utf8");

const form = read("src/components/request-form.tsx");
const page = read("src/app/[locale]/request/page.tsx");
const request = (bundle: { request: object }) =>
  bundle.request as Record<string, string>;

describe("the request form's locked kind", () => {
  it("branches the heading vs. the chooser on lockedKind", () => {
    expect(form).toContain("lockedKind ?");
    expect(form).toContain("lockedKind: Kind | null;");
  });

  it("shows a Change link back to a bare /request, not a query", () => {
    expect(form).toContain('import { TextLink } from "@/components/ui";');
    expect(form).toContain(
      '<TextLink href="/request">{t("changeKind")}</TextLink>',
    );
  });

  it("reuses the ChoiceGroup's own labels for the locked heading, duplicating no copy", () => {
    expect(form).toContain(
      't(kind === "alteration" ? "kindAlteration" : "kindCommission")',
    );
  });

  /**
   * The page's own <PageHeader> already gives the page title "Hacer una
   * solicitud"/"Request an alteration or commission". Repeating it as an
   * eyebrow above the locked heading was redundant; the kind heading and
   * the Cambiar link are what a locked client needs.
   */
  it("drops the eyebrow that repeated the page title above the locked heading", () => {
    expect(form).not.toContain('<p className="eyebrow mb-2">{t("title")}</p>');
  });

  /**
   * The page checks the address against what the shop offers (see
   * lib/estimate-handoff.ts); the form only starts from what it was handed.
   */
  it("opens on what was chosen on the way here", () => {
    expect(form).toContain("prefill: RequestPrefill;");
    expect(form).toContain("useState<string[]>([...prefill.alterationIds])");
    expect(form).toContain("useState(prefill.rush)");
    expect(form).toContain("useState(prefill.categoryId ?? categories[0]?.id");
    expect(form).toContain("useState(prefill.fabricId ?? fabricsForCategory[0]?.id");
  });

  it("offers only the cloths the chosen garment is priced in", () => {
    expect(form).toContain("fabricsForCategory.map((fabric) =>");
    expect(form).not.toContain("{fabrics.map((fabric) =>");
  });

  it("has changeKind in both message bundles, and nowhere else duplicated", () => {
    for (const bundle of [es, en]) {
      expect(request(bundle).changeKind, "changeKind").toBeTruthy();
    }
    expect(request(es).changeKind).toBe("Cambiar");
    expect(request(en).changeKind).toBe("Change");
  });
});

describe("the request page's ?kind and what was chosen", () => {
  it("locks only on a kind the form still offers", () => {
    expect(page).toContain("const locked = KINDS.includes(requested as Kind);");
    expect(page).toContain("lockedKind={locked ? kind : null}");
  });

  /**
   * Without a key, React sees the same `<RequestForm>` element across a
   * client-side navigation from one `?kind=` to another and reuses it, so
   * its internal state (fields already typed, the alteration ticked) survives
   * a switch that should have started fresh. Keying on the locked kind (or
   * "open" for the bare, unlocked chooser) forces a remount instead.
   */
  it("keys the form on the locked kind, so it remounts across a ?kind change", () => {
    expect(page).toContain('key={locked ? kind : "open"}');
  });

  it("reads the choices in the address against the live lists and hands them to the form", () => {
    expect(page).toContain("const prefill = requestPrefill(query, {");
    expect(page).toContain("prefill={prefill}");
    expect(page).toContain("priceList={priceList}");
  });
});

describe("the alteration part of the request form", () => {
  it("shows only the alterations the client chose, as cards with a remove button", () => {
    expect(form).toContain("chosenAlterations.map((alteration) =>");
    expect(form).toContain("translate(alteration.name, locale)");
    expect(form).toContain("formatMoney(alteration.fixedPrice, locale)");
    expect(form).toContain(
      'aria-label={t("removeAlteration", { name: translate(alteration.name, locale) })}',
    );
    expect(form).toContain("×");
    // The old checklist of every alteration is gone.
    expect(form).not.toContain('type="checkbox"');
  });

  it("adds the rest from one select, which lists only what is not chosen and resets", () => {
    expect(form).toContain("remainingAlterations.map((alteration) =>");
    expect(form).toContain('t(alterationIds.length > 0 ? "addAlteration" : "chooseAlteration")');
    expect(form).toMatch(/<Select[\s\S]*?value=""[\s\S]*?addAlteration\(event\.target\.value\)/);
  });

  it("still submits alterationIds, and keeps the rush checkbox", () => {
    expect(form).toMatch(/kind,\s*garmentDescription,\s*alterationIds,/);
    expect(form).toContain("<Checkbox checked={rush} onChange={setRush}>");
  });

  it("asks for the timing on a calendar from today, not as free text", () => {
    expect(form).toMatch(
      /<Field label=\{t\("timing"\)\} optional>[\s\S]*?type="date"[\s\S]*?min=\{today\}[\s\S]*?value=\{preferredTiming\}/,
    );
    expect(form).toContain("const today = shopDay(new Date());");
    expect(form).not.toContain("timingPlaceholder");
    for (const bundle of [es, en]) expect(request(bundle).timingPlaceholder).toBeUndefined();
  });

  it("has its new copy in both bundles, with no dashes", () => {
    expect(request(es).addAlteration).toBe("Agregar otro arreglo…");
    expect(request(en).addAlteration).toBe("Add another alteration…");
    expect(request(es).chooseAlteration).toBe("Elija el arreglo");
    expect(request(en).chooseAlteration).toBe("Choose the alteration");
    for (const bundle of [es, en]) {
      for (const key of [
        "addAlteration",
        "chooseAlteration",
        "removeAlteration",
        "photoNoticeAlteration",
        "photoNoticeCommission",
      ]) {
        expect(request(bundle)[key], key).toBeTruthy();
        expect(request(bundle)[key], key).not.toMatch(/[—–]/);
      }
    }
  });
});

describe("the photo on the request form", () => {
  it("is offered on both kinds, with a notice that says what to photograph", () => {
    expect(form).toContain(
      't(kind === "alteration" ? "photoNoticeAlteration" : "photoNoticeCommission")',
    );
    expect(form.match(/\{photoField\}/g)?.length).toBe(2);
    expect(form).toMatch(/kind,\s*categoryId,[\s\S]*?photoDataUrl: photo\?\.dataUrl/);
  });

  it("says it plainly in both languages", () => {
    expect(request(es).photoNoticeAlteration).toBe("Agregue una foto de la pieza que quiere arreglar.");
    expect(request(en).photoNoticeAlteration).toBe("Add a photo of the piece you want altered.");
    expect(request(es).photoNoticeCommission).toBe(
      "Agregue una foto de lo que se imagina o de una pieza parecida.",
    );
    expect(request(en).photoNoticeCommission).toBe(
      "Add a photo of what you have in mind, or of a similar piece.",
    );
  });
});

describe("the request form's details", () => {
  it("puts the WhatsApp aside behind a ? beside the phone label", () => {
    expect(form).toContain('<Field label={t("phone")} optional tip={t("whatsappHint")}>');
  });

  it("folds the notes behind '+ Algo más'", () => {
    expect(form).toContain('import { MoreBox } from "./more-box";');
    expect(form).toMatch(/<MoreBox value=\{notes\}>\s*<Field label=\{t\("notes"\)\} optional>/);
  });
});
