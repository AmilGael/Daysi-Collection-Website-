import { describe, expect, it } from "vitest";
import { alterationServices, appointmentTypes, priceList } from "./price-list";

/**
 * The August 2026 reduction.
 *
 * Daysi took twenty percent off what she charges for her own time and left the
 * cloth alone. That line matters: a garment price is mostly the material, and
 * discounting it discounts something she has already paid for. So every number
 * that is labour — an alteration, a rush, the made-to-measure supplement, a
 * booked session — comes down, and the eleven garment prices do not move.
 *
 * These are written as the numbers themselves rather than as `before * 0.8`,
 * because a test that recomputes the change from the code it is checking
 * agrees with any mistake the code makes.
 */

const dollars = (cents: number) => cents / 100;

describe("the price of Daysi's time", () => {
  it("takes a fifth off every alteration", () => {
    const priced = Object.fromEntries(
      alterationServices.map((service) => [service.id, dollars(service.fixedPrice)]),
    );

    expect(priced).toEqual({
      "hem-dress": 28,
      "hem-pants": 20,
      waist: 36,
      "side-seams": 44,
      sleeves: 28,
      zipper: 36,
      repair: 20,
      resize: 76,
      restyle: 120,
    });
  });

  it("takes the same fifth off the surcharge for wanting it sooner", () => {
    const rush = Object.fromEntries(
      alterationServices.map((service) => [service.id, dollars(service.rushSurcharge)]),
    );

    expect(rush).toEqual({
      "hem-dress": 20,
      "hem-pants": 20,
      waist: 20,
      "side-seams": 20,
      sleeves: 20,
      zipper: 20,
      repair: 20,
      resize: 28,
      restyle: 40,
    });
  });

  it("takes it off a booked session, and off the deposit that holds it", () => {
    for (const type of appointmentTypes) {
      expect(dollars(type.fee)).toBe(type.id === "consultation-30" ? 80 : 140);
      // The deposit is the fee. A session reduced in price but not in deposit
      // would ask for more up front than the session now costs.
      expect(type.depositDue).toBe(type.fee);
      expect(dollars(type.overtimeRatePerHalfHour)).toBe(40);
    }
  });

  it("takes it off the supplement for making a piece to measure", () => {
    const supplements = priceList.map((entry) => dollars(entry.customizationExtra));
    // Was 55, 65, 95 and 120 across shirts, pants, dresses and heritage.
    expect([...new Set(supplements)].sort((a, b) => a - b)).toEqual([44, 52, 76, 96]);
  });
});

describe("the price of the cloth", () => {
  it("does not move, because the reduction was never against the material", () => {
    const published = Object.fromEntries(
      priceList.map((entry) => [entry.id, dollars(entry.fixedPrice)]),
    );

    expect(published).toEqual({
      "dresses--daisy-cotton": 265,
      "shirts--wax-print": 165,
      "shirts--tropical-leaf": 175,
      "shirts--daisy-cotton": 145,
      "heritage--wax-print": 395,
      "heritage--tropical-leaf": 375,
      "heritage--fish-batik": 395,
      "heritage--frutera-print": 425,
      "pants--ocelote-print": 235,
      "shirts--laguna-wax": 165,
      "dresses--medallon-print": 325,
    });
  });
});

describe("the prices quoted inside the copy", () => {
  /**
   * Two alteration descriptions name an add-on in dollars. They are labour, so
   * they came down with everything else — and a sentence that still says ten
   * when the menu says eight is the kind of thing a client notices at the
   * counter rather than on the site.
   */
  it("came down with the menu they sit in", () => {
    const quoted = alterationServices.flatMap((service) =>
      [service.description.en, service.description.es].flatMap((line) =>
        [...line.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])),
      ),
    );

    expect(quoted.sort((a, b) => a - b)).toEqual([8, 8, 16, 16]);
  });

  it("still records when the list last changed", () => {
    for (const entry of priceList) {
      expect(entry.effectiveDate).toBe("2026-08-28");
    }
  });
});
