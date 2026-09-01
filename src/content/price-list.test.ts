import { describe, expect, it } from "vitest";
import { alterationServices, appointmentTypes, priceList } from "./price-list";

/**
 * The August 2026 reductions, in two passes.
 *
 * First Daysi took twenty percent off what she charges for her own time and
 * left the cloth alone. Then, at the end of the month, she took a quarter off
 * the garments themselves — each price is the original less 25%, settled DOWN
 * to the nearest five dollars, so the discount is never less than promised.
 * The labour prices did not move a second time.
 *
 * These are written as the numbers themselves rather than as `before * 0.75`,
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

describe("the price of the garments", () => {
  it("is the original less a quarter, settled down to the nearest five dollars", () => {
    const published = Object.fromEntries(
      priceList.map((entry) => [entry.id, dollars(entry.fixedPrice)]),
    );

    expect(published).toEqual({
      "dresses--daisy-cotton": 195, // was 265
      "shirts--wax-print": 120, // was 165
      "shirts--tropical-leaf": 130, // was 175
      "shirts--daisy-cotton": 105, // was 145
      "heritage--wax-print": 295, // was 395
      "heritage--tropical-leaf": 280, // was 375
      "heritage--fish-batik": 295, // was 395
      "heritage--frutera-print": 315, // was 425
      "pants--ocelote-print": 175, // was 235
      "shirts--laguna-wax": 120, // was 165
      "dresses--medallon-print": 240, // was 325
    });
  });

  it("never discounts by less than the quarter that was promised", () => {
    const originals: Record<string, number> = {
      "dresses--daisy-cotton": 26500,
      "shirts--wax-print": 16500,
      "shirts--tropical-leaf": 17500,
      "shirts--daisy-cotton": 14500,
      "heritage--wax-print": 39500,
      "heritage--tropical-leaf": 37500,
      "heritage--fish-batik": 39500,
      "heritage--frutera-print": 42500,
      "pants--ocelote-print": 23500,
      "shirts--laguna-wax": 16500,
      "dresses--medallon-print": 32500,
    };

    for (const entry of priceList) {
      const original = originals[entry.id];
      expect(original).toBeDefined();
      expect(entry.fixedPrice).toBeLessThanOrEqual((original ?? 0) * 0.75);
    }
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
      expect(entry.effectiveDate).toBe("2026-08-31");
    }
  });
});
