import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { premiereListing } from "./index";
import { premieres } from "./premieres";

/**
 * A premiere has a release date, and the day after it there may be no next
 * one written down yet: the new season is Daysi's decision, not a code
 * change. Both pages that show the premiere have to stand on their own in
 * that gap rather than lose their hero or present an expired season as next.
 */

const autumn = premieres.find((premiere) => premiere.id === "otono-2026")!;
const dayAfterRelease = new Date("2026-10-07T12:00:00Z");
const beforeRelease = new Date("2026-09-20T12:00:00Z");

describe("the premiere listing", () => {
  it("names the autumn premiere as next while it is still to be released", () => {
    const listing = premiereListing(beforeRelease);
    expect(listing.next?.id).toBe("otono-2026");
    expect(listing.past.map((premiere) => premiere.id)).toEqual(["verano-2026"]);
  });

  it("has no next premiere the day after the last release, and lists every season as past", () => {
    const listing = premiereListing(dayAfterRelease);
    expect(listing.next).toBeUndefined();
    expect(listing.past.map((premiere) => premiere.id)).toEqual(["otono-2026", "verano-2026"]);
  });

  it("still knows the latest season, so the home page has a photograph to show", () => {
    expect(premiereListing(dayAfterRelease).latest?.id).toBe(autumn.id);
    expect(premiereListing(beforeRelease).latest?.id).toBe(autumn.id);
  });
});

describe("the between-seasons copy", () => {
  it("exists in both languages, without em dashes", () => {
    for (const bundle of [es, en]) {
      const messages = bundle.premieres as Record<string, string>;
      expect(messages.betweenTitle).toBeTruthy();
      expect(messages.betweenLead).toBeTruthy();
      for (const value of Object.values(messages)) {
        expect(value).not.toContain("—");
      }
    }
  });
});

const pages = {
  home: "src/app/[locale]/page.tsx",
  premieres: "src/app/[locale]/premieres/page.tsx",
};

describe.each(Object.entries(pages))("the %s page", (_name, relative) => {
  const source = fs.readFileSync(path.join(process.cwd(), relative), "utf8");

  it("reads the listing rather than picking a premiere itself", () => {
    expect(source).toContain("premiereListing(");
    expect(source).not.toContain("premieres[0]");
  });

  it("shows the between-seasons copy when there is no next premiere", () => {
    expect(source).toContain('"betweenTitle"');
    expect(source).toContain('"betweenLead"');
  });
});
