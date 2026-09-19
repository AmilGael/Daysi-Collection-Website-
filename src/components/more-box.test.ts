import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * "Algo más" is optional and most clients leave it empty, so it waits behind
 * a line of text instead of taking a whole box on every form. Source
 * assertions, as elsewhere: there is no DOM in these tests.
 */
const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
const box = read("src/components/more-box.tsx");

describe("the more box", () => {
  it("starts closed, unless there is already something written in it", () => {
    expect(box).toContain('useState(() => value.trim() !== "")');
  });

  it("says whether it is open and what it opens, on both of its buttons", () => {
    expect(box.match(/aria-expanded=\{open\}/g)?.length).toBe(2);
    expect(box.match(/aria-controls=\{regionId\}/g)?.length).toBe(2);
    expect(box).toContain("id={regionId}");
  });

  it("folds the field away without unmounting it, so the text survives", () => {
    expect(box).toContain("hidden={!open}");
    expect(box).not.toMatch(/\{open \? \(\s*children/);
  });

  it("reads '+ Algo más (opcional)' closed and 'Cerrar' open", () => {
    expect(box).toContain('t("moreOpen")');
    expect(box).toContain('t("moreClose")');
    expect(es.common.moreOpen).toBe("Algo más (opcional)");
    expect(en.common.moreOpen).toBe("Anything else (optional)");
    expect(es.common.moreClose).toBe("Cerrar");
    expect(en.common.moreClose).toBe("Close");
  });

  it("folds the optional notes on the request, studio, cart and booking forms", () => {
    for (const file of [
      "src/components/request-form.tsx",
      "src/components/cart-view.tsx",
      "src/components/design-studio.tsx",
      "src/components/appointment-booking.tsx",
    ]) {
      expect(read(file), file).toMatch(/<MoreBox value=\{(notes|purpose)\}>/);
    }
  });

  it("leaves the booking's required purpose and the contact form alone", () => {
    const booking = read("src/components/appointment-booking.tsx");
    expect(booking.match(/<MoreBox/g)?.length).toBe(1);
    expect(booking).toMatch(/<MoreBox value=\{purpose\}>\s*<Field label=\{t\("noteForDaysi"\)\}/);
    expect(read("src/components/contact-form.tsx")).not.toContain("MoreBox");
  });
});
