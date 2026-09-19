import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The "?" beside a label that holds a short aside, like "Daysi atiende mejor
 * por WhatsApp", instead of a line of grey text under every phone field. No
 * DOM here, so this reads the source, the way the other component tests do.
 */
const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
const tip = read("src/components/info-tip.tsx");
const form = read("src/components/form.tsx");

describe("the info tip", () => {
  it("is a real button, named, and described by the text it shows", () => {
    expect(tip).toContain('type="button"');
    expect(tip).toContain('aria-label={t("moreInfo")}');
    expect(tip).toContain("aria-describedby={tipId}");
    expect(tip).toContain('role="tooltip"');
    expect(tip).toContain("id={tipId}");
  });

  it("keeps the text in the DOM when closed, hidden, so a screen reader still gets it", () => {
    expect(tip).toContain("hidden={!open}");
    expect(tip).toContain("{text}");
  });

  it("opens on hover, keyboard focus and a tap, and closes on Escape, blur and a click outside", () => {
    expect(tip).toContain("onPointerEnter");
    expect(tip).toContain("onPointerLeave");
    expect(tip).toContain(":focus-visible");
    expect(tip).toContain("onClick={() => setPinned((current) => !current)}");
    expect(tip).toContain('event.key === "Escape"');
    expect(tip).toContain("onBlur");
    expect(tip).toContain('document.addEventListener("pointerdown"');
    expect(tip).toContain('document.removeEventListener("pointerdown"');
  });

  it("keeps inside a phone screen, above or below the icon", () => {
    expect(tip).toContain("window.innerWidth");
    expect(tip).toContain("window.innerHeight");
    expect(tip).toContain("max-w-[min(16rem,calc(100vw-2rem))]");
  });

  it("wears the site's tokens: a round line-strong edge, paper popover", () => {
    expect(tip).toContain("rounded-full border border-line-strong");
    expect(tip).toContain("text-[0.6875rem]");
    expect(tip).toContain("border-line bg-paper");
    expect(tip).toContain("text-[0.8125rem]");
  });

  it("names the button in both languages", () => {
    expect(es.common.moreInfo).toBe("Más información");
    expect(en.common.moreInfo).toBe("More information");
  });
});

describe("Field's tip", () => {
  it("takes an optional tip and draws it beside the label, outside the <label>", () => {
    expect(form).toContain("tip?: string;");
    expect(form).toContain("<InfoTip id={tipId} text={tip} />");
    // Outside the <label>, or the button's name would join the input's.
    expect(form).toMatch(/\{labelElement\}\s*<InfoTip/);
  });

  it("still describes the input with the tip's text, and keeps hint working", () => {
    expect(form).toContain("[hintId, tipId, errorId]");
    expect(form).toContain("{hint ? (");
  });

  it("is what every optional phone field uses for the WhatsApp aside now", () => {
    for (const file of [
      "src/components/request-form.tsx",
      "src/components/cart-view.tsx",
      "src/components/design-studio.tsx",
      "src/components/appointment-booking.tsx",
    ]) {
      const source = read(file);
      expect(source, file).toMatch(/optional tip=\{tr?\("whatsappHint"\)\}/);
      expect(source, file).not.toContain('hint={tr("whatsappHint")}');
      expect(source, file).not.toContain('hint={t("whatsappHint")}');
    }
  });
});
