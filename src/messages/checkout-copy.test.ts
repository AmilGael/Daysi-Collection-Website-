import { describe, expect, it } from "vitest";
import en from "./en.json";
import es from "./es.json";

/**
 * The thank-you page builds its message keys from the state it is in, so a
 * key missing from one language would not fail a build or a type check — it
 * would render as `checkout.pendingLead` to a client who has just paid.
 */
const STATES = ["thankYou", "pending", "failed", "unknown", "cancelled"] as const;

describe("the checkout page's copy", () => {
  it("has a title and a lead for every state, in both languages", () => {
    for (const bundle of [en, es] as const) {
      for (const state of STATES) {
        const copy = bundle.checkout as Record<string, string | undefined>;
        expect(typeof copy[`${state}Title`]).toBe("string");
        expect(typeof copy[`${state}Lead`]).toBe("string");
      }
    }
  });

  it("names the reference in every lead, so a client always has their number", () => {
    for (const bundle of [en, es] as const) {
      for (const state of STATES) {
        const copy = bundle.checkout as Record<string, string | undefined>;
        expect(copy[`${state}Lead`]).toContain("{reference}");
      }
    }
  });
});
