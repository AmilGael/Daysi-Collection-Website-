import { describe, expect, it } from "vitest";
import type { Promotion, StylePrice } from "@/content";
import {
  discountedAmount,
  pickPromotion,
  promotedPrice,
  promotionActiveToday,
  promotionApplies,
  promotionBadge,
} from "./promotions";

/**
 * A promotion lowers a garment by itself, with no code at checkout. These
 * pin which one reaches a garment on a given day at the atelier, and what it
 * takes off.
 */

const promotion = (over: Partial<Promotion> = {}): Promotion => ({
  id: "prm-aaaaaaaa",
  label: { es: "Venta de otoño", en: "Autumn sale" },
  kind: "percent",
  value: 15,
  scope: { type: "all" },
  active: true,
  updatedAt: "2026-09-18T12:00:00.000Z",
  ...over,
});

const sirena = { id: "sirena", categoryId: "heritage" };
const today = "2026-09-20";

describe("whether a promotion reaches a garment", () => {
  it("reaches every garment when it covers everything", () => {
    expect(promotionApplies(promotion(), sirena, today)).toBe(true);
  });

  it("reaches only its category, or only its garment", () => {
    expect(promotionApplies(promotion({ scope: { type: "category", categoryId: "heritage" } }), sirena, today)).toBe(true);
    expect(promotionApplies(promotion({ scope: { type: "category", categoryId: "dresses" } }), sirena, today)).toBe(false);
    expect(promotionApplies(promotion({ scope: { type: "style", styleId: "sirena" } }), sirena, today)).toBe(true);
    expect(promotionApplies(promotion({ scope: { type: "style", styleId: "frutera" } }), sirena, today)).toBe(false);
  });

  it("does nothing while it is switched off", () => {
    expect(promotionApplies(promotion({ active: false }), sirena, today)).toBe(false);
  });

  it("runs from its first day through its last day, inclusive, and not a day either side", () => {
    const dated = promotion({ startsAt: "2026-09-20", endsAt: "2026-09-27" });
    expect(promotionApplies(dated, sirena, "2026-09-19"), "the day before").toBe(false);
    expect(promotionApplies(dated, sirena, "2026-09-20"), "the first day").toBe(true);
    expect(promotionApplies(dated, sirena, "2026-09-27"), "the last day").toBe(true);
    expect(promotionApplies(dated, sirena, "2026-09-28"), "the day after").toBe(false);
  });

  it("has no start or no end when that date is left blank", () => {
    expect(promotionApplies(promotion({ endsAt: "2026-09-30" }), sirena, "2020-01-01")).toBe(true);
    expect(promotionApplies(promotion({ startsAt: "2026-09-01" }), sirena, "2030-12-31")).toBe(true);
  });
});

describe("which promotion a garment gets", () => {
  const everything = promotion({ id: "prm-everythi", value: 10 });
  const heritage = promotion({ id: "prm-heritage", value: 20, scope: { type: "category", categoryId: "heritage" } });
  const onSirena = promotion({ id: "prm-onsirena", value: 5, scope: { type: "style", styleId: "sirena" } });

  it("takes the garment's own over its category's over everything, whatever the size", () => {
    expect(pickPromotion([everything, heritage, onSirena], sirena, today)?.id).toBe("prm-onsirena");
    expect(pickPromotion([everything, heritage], sirena, today)?.id).toBe("prm-heritage");
    expect(pickPromotion([everything], sirena, today)?.id).toBe("prm-everythi");
  });

  it("passes over one that is off, over or not started for a broader one that runs", () => {
    const off = { ...onSirena, active: false };
    const over = { ...heritage, endsAt: "2026-09-19" };
    expect(pickPromotion([everything, over, off], sirena, today)?.id).toBe("prm-everythi");
    expect(pickPromotion([{ ...onSirena, startsAt: "2026-09-21" }, everything], sirena, today)?.id).toBe("prm-everythi");
  });

  it("between two of the same reach, takes the one saved last", () => {
    const older = promotion({ id: "prm-olderone", updatedAt: "2026-09-01T12:00:00.000Z" });
    const newer = promotion({ id: "prm-newerone", updatedAt: "2026-09-10T12:00:00.000Z" });
    expect(pickPromotion([newer, older], sirena, today)?.id).toBe("prm-newerone");
    expect(pickPromotion([older, newer], sirena, today)?.id).toBe("prm-newerone");
  });

  it("is none when nothing reaches the garment", () => {
    expect(pickPromotion([], sirena, today)).toBeUndefined();
    expect(pickPromotion([promotion({ scope: { type: "category", categoryId: "pants" } })], sirena, today)).toBeUndefined();
  });
});

describe("what a promotion takes off", () => {
  it("takes a percent off to the nearest cent", () => {
    expect(discountedAmount(29500, promotion({ value: 65 }))).toBe(10325);
    expect(discountedAmount(29500, promotion({ value: 60 }))).toBe(11800);
    // 15 % of $105.99 is 1589.85 cents, rounded to 1590.
    expect(discountedAmount(10599, promotion({ value: 15 }))).toBe(9009);
  });

  it("takes a set amount off, and never more than 90 % of the piece", () => {
    expect(discountedAmount(29500, promotion({ kind: "amount", value: 2000 }))).toBe(27500);
    // −$110 on a $105 shirt stops at 90 % off: $10.50, never a piece given away.
    expect(discountedAmount(10500, promotion({ kind: "amount", value: 11000 }))).toBe(1050);
    expect(discountedAmount(10500, promotion({ kind: "amount", value: 9450 }))).toBe(1050);
    expect(discountedAmount(10500, promotion({ kind: "amount", value: 9449 }))).toBe(1051);
  });

  it("caps a stored percent past 90 % at 90 %, the office's own limit on a new one", () => {
    // The office refuses a percent over MOST_PERCENT when a promotion is
    // saved, but a record from before that check (or one edited on disk)
    // could still carry one — this is the last line of defence.
    expect(discountedAmount(29500, promotion({ value: 95 }))).toBe(
      discountedAmount(29500, promotion({ value: 90 })),
    );
    expect(discountedAmount(10000, promotion({ value: 100 }))).toBe(1000);
  });
});

describe("promotionActiveToday", () => {
  it("is true only while active and within its NY-day dates, with no scope to check", () => {
    expect(promotionActiveToday(promotion(), today)).toBe(true);
    expect(promotionActiveToday(promotion({ active: false }), today)).toBe(false);
    expect(promotionActiveToday(promotion({ startsAt: "2026-09-21" }), today)).toBe(false);
    expect(promotionActiveToday(promotion({ endsAt: "2026-09-19" }), today)).toBe(false);
    expect(promotionActiveToday(promotion({ startsAt: "2026-09-20", endsAt: "2026-09-27" }), today)).toBe(true);
  });
});

describe("the tag on a card", () => {
  it("reads a percent as −15 % and an amount as −$20", () => {
    expect(promotionBadge(promotion({ value: 15 }), "es")).toBe("−15 %");
    expect(promotionBadge(promotion({ value: 15 }), "en")).toBe("−15 %");
    expect(promotionBadge(promotion({ kind: "amount", value: 2000 }), "en")).toBe("−$20");
    expect(promotionBadge(promotion({ kind: "amount", value: 2050 }), "es")).toBe("−$20.50");
  });
});

describe("the price a card shows", () => {
  const price: StylePrice = {
    entryId: "heritage--fish-batik",
    fabricId: "fish-batik",
    fixedPrice: 29500,
    customizationExtra: 9600,
    customizationNote: { en: "", es: "" },
    own: false,
  };

  it("is the price alone when no promotion reaches the garment", () => {
    expect(promotedPrice(price)).toEqual({ amount: 29500 });
  });

  it("is the lowered price, with the list price and the promotion beside it", () => {
    const sale = promotion({ value: 65 });
    expect(promotedPrice({ ...price, promotion: sale })).toEqual({ amount: 10325, listAmount: 29500, promotion: sale });
  });

  it("is the price alone when the promotion lowers nothing", () => {
    expect(promotedPrice({ ...price, fixedPrice: 0, promotion: promotion() })).toEqual({ amount: 0 });
  });
});
