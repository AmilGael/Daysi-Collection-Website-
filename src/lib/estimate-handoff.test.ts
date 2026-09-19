import { describe, expect, it } from "vitest";
import { appointmentPrefill, handoffHref, requestPrefill } from "./estimate-handoff";

/**
 * What a client picks in the estimate builder on /prices has to arrive on
 * the page that sends it: the garment and the cloth, the alterations and
 * the rush, the kind of session. The link used to carry only the kind, so
 * the request form opened on its own defaults and the booking page on the
 * first session, whatever had been chosen.
 */

const known = {
  categoryIds: ["dresses", "shirts"],
  fabricIds: ["margarita", "laguna", "batik"],
  alterationIds: ["hem", "waist", "zipper"],
  priced: (categoryId: string, fabricId: string) =>
    (categoryId === "dresses" && fabricId !== "laguna") ||
    (categoryId === "shirts" && fabricId === "laguna"),
};

const parse = (href: string) => Object.fromEntries(new URL(href, "https://x").searchParams);
const readBack = (href: string) => requestPrefill(parse(href), known);

describe("the link out of the estimate builder", () => {
  it("carries the garment and the cloth of something made from scratch", () => {
    const href = handoffHref({ kind: "commission", categoryId: "shirts", fabricId: "laguna" });
    expect(href.startsWith("/request?")).toBe(true);
    expect(parse(href)).toEqual({ kind: "commission", category: "shirts", fabric: "laguna" });
  });

  it("carries every alteration chosen, in the order chosen, and the rush", () => {
    const href = handoffHref({ kind: "alteration", alterationIds: ["zipper", "hem"], rush: true });
    expect(parse(href)).toEqual({ kind: "alteration", alterations: "zipper,hem", rush: "1" });
  });

  it("leaves the rush out when it was not asked for", () => {
    const href = handoffHref({ kind: "alteration", alterationIds: ["hem"], rush: false });
    expect(parse(href)).toEqual({ kind: "alteration", alterations: "hem" });
  });

  it("sends a session to the booking page with its type", () => {
    const href = handoffHref({ kind: "appointment", appointmentTypeId: "consultation-60" });
    expect(href.startsWith("/appointments?")).toBe(true);
    expect(parse(href)).toEqual({ type: "consultation-60" });
  });
});

describe("the request form, reading the link back", () => {
  it("opens on the garment and the cloth that were chosen", () => {
    const href = handoffHref({ kind: "commission", categoryId: "shirts", fabricId: "laguna" });
    expect(readBack(href)).toEqual({ categoryId: "shirts", fabricId: "laguna", alterationIds: [], rush: false });
  });

  it("opens with the alterations chosen and the rush", () => {
    const href = handoffHref({ kind: "alteration", alterationIds: ["zipper", "hem"], rush: true });
    expect(readBack(href)).toEqual({ alterationIds: ["zipper", "hem"], rush: true });
  });

  it("still takes the one alteration an alteration card sends", () => {
    expect(requestPrefill({ kind: "alteration", alteration: "waist" }, known).alterationIds).toEqual(["waist"]);
  });

  it("drops what the shop no longer offers, and never repeats an alteration", () => {
    const prefill = requestPrefill(
      { category: "gowns", fabric: "velvet", alterations: "hem,ghost,hem,waist", alteration: "waist" },
      known,
    );
    expect(prefill).toEqual({ alterationIds: ["hem", "waist"], rush: false });
  });

  it("keeps the garment but not a cloth it is not made in", () => {
    expect(requestPrefill({ category: "shirts", fabric: "margarita" }, known)).toEqual({
      categoryId: "shirts",
      alterationIds: [],
      rush: false,
    });
  });

  it("ignores a cloth that arrives without a garment", () => {
    expect(requestPrefill({ fabric: "laguna" }, known)).toEqual({ alterationIds: [], rush: false });
  });

  it("reads only the first of a repeated parameter", () => {
    expect(requestPrefill({ category: ["shirts", "dresses"], rush: ["1", "0"] }, known)).toEqual({
      categoryId: "shirts",
      alterationIds: [],
      rush: true,
    });
  });
});

describe("the booking page, reading the link back", () => {
  const types = ["consultation-30", "consultation-60"];

  it("opens on the session that was chosen", () => {
    expect(appointmentPrefill({ type: "consultation-60" }, types)).toBe("consultation-60");
  });

  it("opens on its own default when the type is missing or unknown", () => {
    expect(appointmentPrefill({}, types)).toBeUndefined();
    expect(appointmentPrefill({ type: "spa-day" }, types)).toBeUndefined();
  });
});
