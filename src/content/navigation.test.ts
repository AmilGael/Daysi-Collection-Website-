import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BAR_TABS, NAV_TABS } from "./navigation";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The header used to keep two hand-written lists of destinations: six in the
 * bar, eight in the menu, maintained by hand and free to disagree. They are one
 * list now, and the bar is a view of it.
 *
 * The rule underneath these tests is the one the menu button has to earn: it
 * is an overflow, not a second copy of the bar. On a screen wide enough to show
 * the tabs, opening the menu has to reach something the tabs cannot.
 */

const pagesRoot = path.join(process.cwd(), "src/app/[locale]");

describe("the destinations", () => {
  it("keeps one list, with the bar as a view of it", () => {
    for (const tab of BAR_TABS) {
      expect(NAV_TABS).toContain(tab);
    }
  });

  it("orders the bar the way the menu orders it", () => {
    const menuOrder = NAV_TABS.map((tab) => tab.href);
    const barOrder = BAR_TABS.map((tab) => tab.href);
    expect(barOrder).toEqual(menuOrder.filter((href) => barOrder.includes(href)));
  });

  it("names no destination twice", () => {
    const hrefs = NAV_TABS.map((tab) => tab.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("leads only to pages that exist", () => {
    const missing = NAV_TABS.filter(
      (tab) => !fs.existsSync(path.join(pagesRoot, tab.href.slice(1), "page.tsx")),
    ).map((tab) => tab.href);

    expect(missing).toEqual([]);
  });
});

describe("the menu button", () => {
  /**
   * The complaint that started this: a control in the corner that opened onto
   * the same tabs already printed beside it. If the bar ever grows to cover
   * everything, the button should go, not sit there restating the bar.
   */
  it("reaches somewhere the tab bar does not", () => {
    const beyondTheBar = NAV_TABS.filter((tab) => !BAR_TABS.includes(tab));
    expect(beyondTheBar.length).toBeGreaterThan(0);
  });
});

describe("the labels", () => {
  it("is written in both languages", () => {
    const untranslated = NAV_TABS.filter(
      (tab) =>
        !(tab.label in (en.nav as Record<string, string>)) ||
        !(tab.label in (es.nav as Record<string, string>)),
    ).map((tab) => tab.label);

    expect(untranslated).toEqual([]);
  });

  /**
   * Spanish is the wider locale and the bar is width-bound: the six tabs, the
   * logo and the controls already needed 1189px before anything was added to
   * them. Anything long enough to wrap belongs in the menu, not the bar.
   */
  it("keeps the bar's Spanish labels short enough to stay on one line", () => {
    const nav = es.nav as Record<string, string>;
    const tooLong = BAR_TABS.map((tab) => nav[tab.label] ?? "").filter(
      (label) => label.length > 16,
    );

    expect(tooLong).toEqual([]);
  });
});
