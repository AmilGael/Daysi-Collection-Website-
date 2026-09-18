import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * "Too many words and nothing to show on a literal clothing page." The
 * alterations page is cards now: a drawing (or Daysi's photo), the name, one
 * line, the price large and the turnaround small, with one switch that turns
 * every price into its rush price. No DOM in these tests, so the agreement is
 * checked in the source.
 */
const pageSource = readFileSync(path.join(process.cwd(), "src/app/[locale]/alterations/page.tsx"), "utf8");
const cardsSource = readFileSync(path.join(process.cwd(), "src/components/alteration-cards.tsx"), "utf8");
const alterations = (bundle: { alterations: object }) => bundle.alterations as Record<string, string>;

describe("the alterations page", () => {
  it("opens with the title and the one line that a price can grow, and no long lead", () => {
    expect(pageSource).toContain('<PageHeader title={t("title")} lead={t("variesNote")} />');
    expect(alterations(es).lead).toBeUndefined();
    expect(alterations(en).lead).toBeUndefined();
  });

  it("shows the live list as cards, not a table", () => {
    expect(pageSource).toContain("<AlterationCards alterations={liveAlterations()} locale={language} />");
    expect(pageSource).not.toContain("<table");
    expect(cardsSource).toContain("grid grid-cols-2");
    expect(cardsSource).toContain("lg:grid-cols-3");
  });

  it("sends each card to the request form with its alteration ticked", () => {
    expect(cardsSource).toContain("href={`/request?kind=alteration&alteration=${encodeURIComponent(alteration.id)}`}");
  });

  it("draws each alteration, unless Daysi gave it a photo", () => {
    expect(cardsSource).toContain('import { markFor } from "@/content/alteration-marks"');
    expect(cardsSource).toMatch(/alteration\.photo \? \(\s*<Image/);
    expect(cardsSource).toContain("<Mark id={alteration.id} />");
  });

  it("turns every price into its own rush price with one switch", () => {
    expect(cardsSource).toContain('role="switch"');
    expect(cardsSource).toContain("alteration.fixedPrice + (rush ? alteration.rushSurcharge : 0)");
    expect(alterations(es).rushToggle).toBe("Con urgencia · +{amount} · listo antes");
  });

  it("says how a request goes in three steps, then the guarantee, the photograph and the way in", () => {
    expect([alterations(es).stepTell, alterations(es).stepPrice, alterations(es).stepCollect]).toEqual([
      "Cuénteme qué tiene",
      "Le confirmo el precio",
      "Lo recoge listo",
    ]);
    expect(pageSource).toContain("grid grid-cols-3");
    const order = ['t("stepTell")', 't("guarantee")', "/images/real/craft-detail.jpg", '"/request?kind=alteration"'].map(
      (marker) => pageSource.indexOf(marker),
    );
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
