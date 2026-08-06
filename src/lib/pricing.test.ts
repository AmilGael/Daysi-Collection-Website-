import { describe, expect, it } from "vitest";
import { findPriceEntry, findAppointmentType, findAlteration } from "@/content";
import {
  estimateAlteration,
  estimateAppointment,
  estimateCommission,
  estimateReadyMade,
} from "./pricing";

/**
 * These cover the promises the site makes out loud: that the published price is
 * the price charged, that nothing a browser sends can change an amount, and
 * that the deposit rules match what the terms say.
 */

describe("ready-made orders", () => {
  it("charges the published fixed price for the piece", () => {
    const published = findPriceEntry("dresses--floral-linen");
    const estimate = estimateReadyMade({
      styleSlug: "flor-de-sol",
      sizeId: "m",
      customize: false,
    });

    expect(estimate?.subtotal).toBe(published?.fixedPrice);
  });

  it("adds the customisation charge as a set amount, not a negotiation", () => {
    const published = findPriceEntry("dresses--floral-linen");
    const estimate = estimateReadyMade({
      styleSlug: "flor-de-sol",
      sizeId: "m",
      customize: true,
    });

    expect(estimate?.subtotal).toBe(
      (published?.fixedPrice ?? 0) + (published?.customizationExtra ?? 0),
    );
  });

  it("takes payment in full for a piece bought as cut", () => {
    const estimate = estimateReadyMade({
      styleSlug: "flor-de-sol",
      sizeId: "m",
      customize: false,
    });

    expect(estimate?.dueNow).toBe(estimate?.total);
    expect(estimate?.dueOnCollection).toBe(0);
  });

  it("takes half up front once a piece is made to measure", () => {
    const estimate = estimateReadyMade({
      styleSlug: "flor-de-sol",
      sizeId: "m",
      customize: true,
    });

    expect(estimate?.dueNow).toBe(Math.round((estimate?.total ?? 0) / 2));
  });

  it("refuses a size the style is not offered in", () => {
    expect(estimateReadyMade({ styleSlug: "flor-de-sol", sizeId: "xxl", customize: false })).toBeNull();
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
      styleSlug: "flor-de-sol",
      sizeId: "m",
      customize: false,
    });
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
    // Shirts are not offered in floral linen, so there is no price to quote.
    expect(
      estimateCommission({ categoryId: "shirts", fabricId: "floral-linen", customize: true }),
    ).toBeNull();
  });

  it("takes half up front to reserve the cloth", () => {
    const estimate = estimateCommission({
      categoryId: "heritage",
      fabricId: "wax-print",
      customize: true,
    });

    expect(estimate?.dueNow).toBe(Math.round((estimate?.total ?? 0) / 2));
    expect(estimate?.dueOnCollection).toBe((estimate?.total ?? 0) - (estimate?.dueNow ?? 0));
  });
});

describe("every estimate", () => {
  it("adds up: the lines make the subtotal, and the split makes the total", () => {
    const estimates = [
      estimateReadyMade({ styleSlug: "yurumein", sizeId: "s", customize: true }),
      estimateAlteration({ alterationIds: ["resize", "sleeves"], rush: true }),
      estimateCommission({ categoryId: "dresses", fabricId: "black-linen", customize: true }),
      estimateAppointment("consultation-60"),
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
