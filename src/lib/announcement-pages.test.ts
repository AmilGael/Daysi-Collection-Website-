import { describe, expect, it } from "vitest";
import { ANNOUNCEMENT_PAGES, pageForPath, reaches } from "./announcement-pages";

/**
 * Daysi picks, for each announcement, the pages of the shop it shows on.
 * The bar is drawn by the layout, which only knows the address, so the
 * address has to name the page the same way in both languages and on a
 * garment's own page.
 */
describe("which page of the shop an address is", () => {
  it("reads the page after the language, in both languages", () => {
    expect(pageForPath("/es")).toBe("home");
    expect(pageForPath("/en/")).toBe("home");
    expect(pageForPath("/es/collection")).toBe("collection");
    expect(pageForPath("/en/appointments")).toBe("appointments");
    expect(pageForPath("/es/design-studio")).toBe("studio");
  });

  it("counts a garment's own page as the collection", () => {
    expect(pageForPath("/es/collection/frutera")).toBe("collection");
  });

  it("is no page of the shop for the office, the account or signing in", () => {
    expect(pageForPath("/es/office")).toBeNull();
    expect(pageForPath("/es/office/shopfront")).toBeNull();
    expect(pageForPath("/en/account/orders")).toBeNull();
    expect(pageForPath("/es/sign-in")).toBeNull();
    expect(pageForPath("/es/checkout/thank-you")).toBeNull();
  });

  it("names every page once", () => {
    const ids = ANNOUNCEMENT_PAGES.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
    const segments = ANNOUNCEMENT_PAGES.map((page) => page.segment);
    expect(new Set(segments).size).toBe(segments.length);
  });
});

describe("whether an announcement shows on a page", () => {
  it("shows on the pages ticked, and on every shop page when all are", () => {
    expect(reaches(["home", "appointments"], "appointments")).toBe(true);
    expect(reaches(["home", "appointments"], "collection")).toBe(false);
    expect(reaches("all", "cart")).toBe(true);
  });

  it("never shows outside the shop, even when set to every page", () => {
    expect(reaches("all", null)).toBe(false);
  });
});
