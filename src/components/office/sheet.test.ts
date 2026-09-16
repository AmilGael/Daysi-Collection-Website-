import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The sheet is where Daysi edits one thing at a time. The agreements the
 * design makes (Amendment 4 §2) are checked in the source: it sits below
 * the confirm bar and leaves the bar's height free, Escape and the phone's
 * back gesture close it, and the history entry it pushes keeps Next's own
 * state so the router never sees a foreign entry.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/office/sheet.tsx"), "utf8");
const office = (bundle: { office: object }) => bundle.office as Record<string, string>;

describe("the sheet", () => {
  it("is a dialog that stays under the confirm bar", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("fixed inset-0 z-50");
    expect(source).toContain("bottom-16");
  });

  it("closes on Escape and on the back gesture, and keeps the router's history state", () => {
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('window.addEventListener("popstate"');
    expect(source).toContain("window.history.pushState({ ...window.history.state, sheet: true }");
  });

  it("is closed by Listo in both languages", () => {
    expect(office(es).sheetDone).toBe("Listo");
    expect(office(en).sheetDone).toBe("Done");
  });

  it("focuses the first control inside its content, and names its buttons by what they show", () => {
    expect(source).toContain('const first = content.current?.querySelector<HTMLElement>("input, textarea, select, button");');
    expect(source).not.toContain('aria-label={t("sheetClose")}\n            className={buttonClass');
    expect(source).toContain('aria-label={t("sheetClose")}\n        onClick={onClose}');
  });
});
