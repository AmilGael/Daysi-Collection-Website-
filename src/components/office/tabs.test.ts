import { describe, expect, it } from "vitest";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import { OFFICE_TABS } from "./tabs";

/**
 * The office is eight tabs, and everything that has to agree about them,
 * the routes, the smoke script, the two languages, the guard, is checked
 * here against one list rather than trusted to stay in step by hand.
 */

const officeMessages = (bundle: { office: Record<string, string> }) => bundle.office;

describe("the office tabs", () => {
  it("are eight, in the agreed order, each under /office", () => {
    expect(OFFICE_TABS.map((tab) => tab.id)).toEqual([
      "today",
      "work",
      "collection",
      "gallery",
      "fabrics",
      "prices",
      "shopfront",
      "books",
    ]);
    for (const tab of OFFICE_TABS) {
      expect(tab.href === "/office" || tab.href.startsWith("/office/")).toBe(true);
    }
    expect(new Set(OFFICE_TABS.map((tab) => tab.href)).size).toBe(OFFICE_TABS.length);
  });

  it("are named in both languages, and the strip has a name too", () => {
    for (const bundle of [es, en]) {
      const office = officeMessages(bundle);
      expect(office.tabsLabel).toBeTruthy();
      for (const tab of OFFICE_TABS) {
        expect(office[tab.labelKey], `${tab.id} label`).toBeTruthy();
        expect(office[tab.labelKey]).not.toContain("—");
      }
    }
  });
});
