import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import type { Localized, Premiere } from "./types";
import { premiereListing, premiereListingFrom } from "./index";
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
/** 8 PM in New York on the eve of the release: still the eve. */
const eveOfReleaseNewYork = new Date("2026-10-06T00:00:00Z");
/** 8 AM in New York on release day itself. */
const morningOfRelease = new Date("2026-10-06T12:00:00Z");
/** 11 PM in New York on release day, which is already the 7th in UTC. */
const nightOfReleaseNewYork = new Date("2026-10-07T03:00:00Z");

describe("the premiere listing", () => {
  it("names the autumn premiere as next while it is still to be released", () => {
    const listing = premiereListing(beforeRelease);
    expect(listing.next?.id).toBe("otono-2026");
    expect(listing.past.map((premiere) => premiere.id)).toEqual(["verano-2026"]);
  });

  it("counts the days in New York, so the season is still next through its whole release day", () => {
    expect(premiereListing(eveOfReleaseNewYork).next?.id).toBe("otono-2026");
    expect(premiereListing(morningOfRelease).next?.id).toBe("otono-2026");
    expect(premiereListing(nightOfReleaseNewYork).next?.id).toBe("otono-2026");
  });

  it("has no next premiere the day after the last release, and lists every season as past", () => {
    const listing = premiereListing(dayAfterRelease);
    expect(listing.next).toBeUndefined();
    expect(listing.past.map((premiere) => premiere.id)).toEqual(["otono-2026", "verano-2026"]);
  });

  it("always features the newest season, so the home page has a photograph to show", () => {
    expect(premiereListing(dayAfterRelease).featured?.id).toBe(autumn.id);
    expect(premiereListing(beforeRelease).featured?.id).toBe(autumn.id);
  });

  it("premiereListingFrom is what premiereListing reads", () => {
    for (const today of [beforeRelease, dayAfterRelease, eveOfReleaseNewYork, morningOfRelease, nightOfReleaseNewYork]) {
      expect(premiereListing(today)).toEqual(premiereListingFrom(premieres, today));
    }
  });
});

describe("the premieres list", () => {
  it("is written down newest first, which is what `featured` and `past` read off of", () => {
    const dates = premieres.map((premiere) => premiere.releaseDate);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe("choosing which premiere is next", () => {
  const localized = (es: string): Localized => ({ es, en: es });
  const shared = {
    season: localized("Temporada"),
    title: localized("Título"),
    story: localized("Historia"),
    inspiration: localized("Inspiración"),
    revealDate: "2026-01-01",
    piecesPlanned: 5,
    editionSize: 10,
    coverImage: "/images/real/x.jpg",
    styleIds: [] as readonly string[],
  };
  // Written down newest first, the way every list here runs: the further-out
  // release listed before the sooner one.
  const later: Premiere = { ...shared, id: "later", slug: "later", releaseDate: "2027-05-01" };
  const sooner: Premiere = { ...shared, id: "sooner", slug: "sooner", releaseDate: "2027-02-01" };

  it("is whichever upcoming season releases soonest, not whichever is listed first", () => {
    const listing = premiereListingFrom([later, sooner, ...premieres], new Date("2026-10-07T12:00:00Z"));
    expect(listing.next?.id).toBe("sooner");
    // Both premieres still to come sit outside `past`: only what has
    // actually released does, and `sooner`, being next, is not in it either.
    expect(listing.past.map((premiere) => premiere.id)).toEqual(["otono-2026", "verano-2026"]);
  });

  it("features the same season as next, not the furthest-out one, so the cover and the words never disagree", () => {
    // `later` is listed first (newest-first), yet `sooner` is next; the
    // photograph a page shows next to next's words has to be sooner's.
    const listing = premiereListingFrom([later, sooner, ...premieres], new Date("2026-10-07T12:00:00Z"));
    expect(listing.featured).toBe(listing.next);
    expect(listing.featured?.id).toBe("sooner");
  });
});

describe("the between-seasons copy", () => {
  it("exists in both languages, without em dashes", () => {
    for (const bundle of [es, en]) {
      const messages = bundle.premieres as Record<string, string>;
      for (const key of ["betweenTitle", "betweenLead", "leadBetween", "betweenContact"]) {
        expect(messages[key], key).toBeTruthy();
      }
      expect(bundle.home.premiereLinkBetween).toBeTruthy();
      const strings = [...Object.values(messages), ...Object.values(bundle.home)].filter(
        (value): value is string => typeof value === "string",
      );
      for (const value of strings) {
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
    // Both pages read the live listing now (Task 14), so the call is
    // `livePremiereListing(`; the check still asks for the "…PremiereListing("
    // tail rather than the bare seed-only `premiereListing(` name, so a page
    // that goes back to picking `premieres[0]` itself still fails it.
    expect(source).toContain("PremiereListing(");
    expect(source).not.toContain("premieres[0]");
  });

  it("shows the between-seasons copy when there is no next premiere", () => {
    expect(source).toContain('"betweenTitle"');
    expect(source).toContain('"betweenLead"');
  });
});

describe("between seasons", () => {
  it("the premieres page offers a way to get in touch, since there is no list to join yet", () => {
    const source = fs.readFileSync(path.join(process.cwd(), pages.premieres), "utf8");
    expect(source).toContain('"leadBetween"');
    expect(source).toContain('"betweenContact"');
    expect(source).toContain('href="/contact"');
  });

  it("the home page does not promise a premiere to see", () => {
    const source = fs.readFileSync(path.join(process.cwd(), pages.home), "utf8");
    expect(source).toContain('"premiereLinkBetween"');
  });
});
