import { describe, expect, it } from "vitest";
import { liveFindAlteration as findAlteration, liveFindAppointmentType as findAppointmentType } from "./live-pricing";
import { liveFindPriceEntry as findPriceEntry } from "./live-pricing";
import {
  applyPromotion,
  estimateAlteration,
  estimateAppointment,
  estimateCart,
  estimateCommission,
  estimateDesign,
  estimateNoted,
  estimateReadyMade,
  isTaxable,
  type EstimateLine,
} from "./pricing";
import { designFee, type Promotion } from "@/content";

/**
 * These cover the promises the site makes out loud: that the published price is
 * the price charged, that nothing a browser sends can change an amount, and
 * that the deposit rules match what the terms say.
 */

describe("ready-made orders", () => {
  it("charges the published fixed price for the piece", () => {
    const published = findPriceEntry("heritage--frutera-print");
    const estimate = estimateReadyMade({
      styleSlug: "frutera",
      sizeId: "m",
      customize: false,
    });

    expect(estimate?.subtotal).toBe(published?.fixedPrice);
  });

  it("adds the customisation charge as a set amount, not a negotiation", () => {
    const published = findPriceEntry("heritage--frutera-print");
    const estimate = estimateReadyMade({
      styleSlug: "frutera",
      sizeId: "m",
      customize: true,
    });

    expect(estimate?.subtotal).toBe(
      (published?.fixedPrice ?? 0) + (published?.customizationExtra ?? 0),
    );
  });

  it("takes payment in full for a piece bought as cut", () => {
    const estimate = estimateReadyMade({
      styleSlug: "frutera",
      sizeId: "m",
      customize: false,
    });

    expect(estimate?.dueNow).toBe(estimate?.total);
    expect(estimate?.dueOnCollection).toBe(0);
  });

  it("takes half up front once a piece is made to measure", () => {
    const estimate = estimateReadyMade({
      styleSlug: "frutera",
      sizeId: "m",
      customize: true,
    });

    expect(estimate?.dueNow).toBe(Math.round((estimate?.total ?? 0) / 2));
  });

  it("refuses a size the style is not offered in", () => {
    expect(estimateReadyMade({ styleSlug: "frutera", sizeId: "xxl", customize: false })).toBeNull();
  });

  it("refuses a style that does not exist", () => {
    expect(estimateReadyMade({ styleSlug: "not-a-style", sizeId: "m", customize: false })).toBeNull();
  });
});

describe("New York clothing sales tax", () => {
  it("does not tax a garment under the $110 exemption", () => {
    const estimate = estimateAlteration({ alterationIds: ["hem-dress"], rush: false });
    expect(estimate?.salesTax).toBe(0);
  });

  it("taxes a garment at or above the exemption", () => {
    const estimate = estimateReadyMade({
      styleSlug: "frutera",
      sizeId: "m",
      customize: false,
    });
    expect(estimate?.salesTax).toBeGreaterThan(0);
  });

  it("keeps the exemption per item when several of one garment are bought", () => {
    // New York exempts clothing under $110 a piece. Two $105 shirts are two
    // exempt garments, not one $210 taxable line, and the difference is money
    // Daysi would be collecting without owing it.
    const shirt = findPriceEntry("shirts--daisy-cotton");
    const estimate = estimateCart([
      { styleSlug: "amapola", sizeId: "s", customize: false, quantity: 2 },
    ]);
    expect(shirt?.fixedPrice).toBeLessThan(11000);
    expect(estimate?.subtotal).toBe((shirt?.fixedPrice ?? 0) * 2);
    expect(estimate?.salesTax).toBe(0);
    expect(estimate?.total).toBe(estimate?.subtotal);
  });

  it("still taxes several of a garment that is over the exemption on its own", () => {
    const set = findPriceEntry("heritage--fish-batik");
    const estimate = estimateCart([
      { styleSlug: "sirena", sizeId: "s", customize: false, quantity: 2 },
    ]);
    expect(set?.fixedPrice).toBeGreaterThan(11000);
    expect(estimate?.salesTax).toBeGreaterThan(0);
  });

  it("does not apply the clothing rule to a consultation fee", () => {
    // The one-hour session is over $110, so an amount-only rule would tax it.
    // It is Daysi's time, not a garment, and is left for her accountant.
    const estimate = estimateAppointment("consultation-60");
    expect(estimate?.lines.every((line) => line.taxBasis === "service")).toBe(true);
    expect(estimate?.salesTax).toBe(0);
    expect(estimate?.total).toBe(estimate?.subtotal);
  });
});

describe("alterations", () => {
  it("prices each chosen alteration from the published list", () => {
    const hem = findAlteration("hem-dress");
    const zipper = findAlteration("zipper");
    const estimate = estimateAlteration({
      alterationIds: ["hem-dress", "zipper"],
      rush: false,
    });

    expect(estimate?.subtotal).toBe((hem?.fixedPrice ?? 0) + (zipper?.fixedPrice ?? 0));
  });

  it("adds the rush charge once per alteration", () => {
    const plain = estimateAlteration({ alterationIds: ["hem-dress", "zipper"], rush: false });
    const rushed = estimateAlteration({ alterationIds: ["hem-dress", "zipper"], rush: true });
    const hem = findAlteration("hem-dress");
    const zipper = findAlteration("zipper");

    expect((rushed?.subtotal ?? 0) - (plain?.subtotal ?? 0)).toBe(
      (hem?.rushSurcharge ?? 0) + (zipper?.rushSurcharge ?? 0),
    );
  });

  it("asks for nothing up front, because alterations are paid on collection", () => {
    const estimate = estimateAlteration({ alterationIds: ["hem-dress"], rush: false });
    expect(estimate?.dueNow).toBe(0);
    expect(estimate?.dueOnCollection).toBe(estimate?.total);
  });

  it("refuses an alteration that is not on the list", () => {
    expect(estimateAlteration({ alterationIds: ["free-please"], rush: false })).toBeNull();
  });

  it("refuses an empty basket", () => {
    expect(estimateAlteration({ alterationIds: [], rush: false })).toBeNull();
  });
});

describe("appointments", () => {
  it("takes the whole session fee at booking, to hold the time", () => {
    const type = findAppointmentType("consultation-30");
    const estimate = estimateAppointment("consultation-30");

    expect(estimate?.dueNow).toBe(type?.depositDue);
    expect(estimate?.subtotal).toBe(type?.fee);
  });

  it("never asks for more than the total", () => {
    for (const id of ["consultation-30", "consultation-60"]) {
      const estimate = estimateAppointment(id);
      expect(estimate?.dueNow).toBeLessThanOrEqual(estimate?.total ?? 0);
    }
  });

  it("refuses a session type that does not exist", () => {
    expect(estimateAppointment("consultation-999")).toBeNull();
  });
});

describe("commissions", () => {
  it("refuses a garment and cloth pair with no published price", () => {
    // Shirts are not offered in the medallon print, so there is no price to quote.
    expect(
      estimateCommission({ categoryId: "shirts", fabricId: "medallon-print", customize: true }),
    ).toBeNull();
  });

  it("takes half up front to reserve the cloth", () => {
    const estimate = estimateCommission({
      categoryId: "heritage",
      fabricId: "fish-batik",
      customize: true,
    });

    expect(estimate?.dueNow).toBe(Math.round((estimate?.total ?? 0) / 2));
    expect(estimate?.dueOnCollection).toBe((estimate?.total ?? 0) - (estimate?.dueNow ?? 0));
  });
});

describe("a design sent from the studio", () => {
  it("is one untaxed service line of the design fee, paid in full now", () => {
    const estimate = estimateDesign();

    expect(designFee).toBe(2000);
    expect(estimate.lines).toHaveLength(1);
    expect(estimate.lines[0]).toMatchObject({ amount: designFee, taxBasis: "service" });
    expect(estimate.salesTax).toBe(0);
    expect(estimate.total).toBe(designFee);
    expect(estimate.dueNow).toBe(estimate.total);
    expect(estimate.dueOnCollection).toBe(0);
  });
});

describe("an order noted from the office", () => {
  it("records exactly the amount typed, untaxed, whatever the kind", () => {
    // $200: well over the clothing exemption, which is exactly the point —
    // a noted line is never taxed on top of what Daysi says she collected.
    for (const kind of ["order", "alteration", "commission"] as const) {
      const estimate = estimateNoted(20000, kind);
      expect(estimate.lines).toHaveLength(1);
      expect(estimate.lines[0]).toMatchObject({ amount: 20000, taxBasis: "service" });
      expect(estimate.salesTax, kind).toBe(0);
      expect(estimate.total, kind).toBe(20000);
      expect(estimate.dueNow).toBe(20000);
      expect(estimate.dueOnCollection).toBe(0);
    }
  });

  it("labels the line so her accountant can tell it apart from one the site priced", () => {
    const estimate = estimateNoted(9500, "order");
    expect(estimate.lines[0]?.label).toEqual({
      en: "Noted in the office · total received",
      es: "Anotado en el taller · total recibido",
    });
  });
});

describe("every estimate", () => {
  it("adds up: the lines make the subtotal, and the split makes the total", () => {
    const estimates = [
      estimateReadyMade({ styleSlug: "yurumein", sizeId: "s", customize: true }),
      estimateAlteration({ alterationIds: ["resize", "sleeves"], rush: true }),
      estimateCommission({ categoryId: "dresses", fabricId: "medallon-print", customize: true }),
      estimateAppointment("consultation-60"),
      estimateDesign(),
      estimateNoted(20000, "order"),
    ];

    for (const estimate of estimates) {
      expect(estimate).not.toBeNull();
      if (!estimate) continue;

      const lineTotal = estimate.lines.reduce((total, line) => total + line.amount, 0);
      expect(estimate.subtotal).toBe(lineTotal);
      expect(estimate.total).toBe(estimate.subtotal + estimate.salesTax);
      expect(estimate.dueNow + estimate.dueOnCollection).toBe(estimate.total);
      expect(Number.isInteger(estimate.total)).toBe(true);
    }
  });
});

describe("a promotion on a garment line", () => {
  const percent = (value: number): Promotion => ({
    id: "prm-aaaaaaaa",
    label: { es: "Venta de otoño", en: "Autumn sale" },
    kind: "percent",
    value,
    scope: { type: "all" },
    active: true,
    updatedAt: "2026-09-18T12:00:00.000Z",
  });
  // A $295 heritage set, as the cart writes it: two pieces on one line.
  const pair: EstimateLine = {
    label: { en: "Sirena shirt dress", es: "Vestido camisero Sirena" },
    note: { en: "Size M · 2 pieces", es: "Talla M · 2 piezas" },
    amount: 59000,
    unitAmount: 29500,
    taxBasis: "clothing",
  };
  const single: EstimateLine = { label: pair.label, amount: 29500, taxBasis: "clothing" };

  it("is the same line when no promotion reaches it", () => {
    expect(applyPromotion(pair, undefined, 2)).toBe(pair);
    expect(applyPromotion(single, undefined)).toBe(single);
  });

  it("lowers the piece, multiplies back by the quantity, and keeps the list figures", () => {
    expect(applyPromotion(pair, percent(15), 2)).toEqual({
      ...pair,
      amount: 50150,
      unitAmount: 25075,
      listAmount: 59000,
      listUnitAmount: 29500,
    });
  });

  it("lowers a single piece without inventing a per-piece figure", () => {
    expect(applyPromotion(single, percent(15))).toEqual({ ...single, amount: 25075, listAmount: 29500 });
  });

  it("judges the $110 exemption on the lowered piece: 65 % takes a $295 set under it, 60 % does not", () => {
    // 65 % off $295 is $103.25 a piece; 60 % off is $118.
    const underLine = applyPromotion(pair, percent(65), 2);
    expect(underLine.unitAmount).toBe(10325);
    expect(isTaxable(underLine)).toBe(false);
    const overLine = applyPromotion(pair, percent(60), 2);
    expect(overLine.unitAmount).toBe(11800);
    expect(isTaxable(overLine)).toBe(true);
  });

  it("is the same line when the promotion lowers nothing", () => {
    const free = { ...single, amount: 0 };
    expect(applyPromotion(free, percent(15))).toBe(free);
  });
});
