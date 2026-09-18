import { describe, expect, it } from "vitest";
import type { StoredRequest } from "./request-store";
import { availableCount, piecesTaken, stockShortfall, type TakenPiece } from "./stock";

const NOW = new Date("2026-09-20T15:00:00.000Z");
const minutesBefore = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const order = (over: Partial<StoredRequest> = {}): StoredRequest => ({
  reference: "ORD-1",
  kind: "order",
  submittedAt: minutesBefore(10),
  locale: "es",
  client: { name: "Ana", email: "ana@example.com" },
  details: {},
  pieces: [{ styleId: "sol", sizeId: "s", quantity: 1, madeToMeasure: false }],
  status: "new",
  ...over,
});

const paid = (over: Partial<StoredRequest> = {}): StoredRequest =>
  order({ status: "paid", source: "stripe", paidVia: "card", paidAt: minutesBefore(5), ...over });

describe("the pieces an order takes off the rack", () => {
  it("counts a piece Stripe has been paid for as sold, at the moment it was paid", () => {
    expect(piecesTaken([[order({ awaitingPayment: true }), paid()]], NOW)).toEqual([
      { styleId: "sol", sizeId: "s", quantity: 1, soldAt: minutesBefore(5) },
    ]);
  });

  it("holds a piece while the card page is still open", () => {
    expect(piecesTaken([[order({ awaitingPayment: true })]], NOW)).toEqual([
      { styleId: "sol", sizeId: "s", quantity: 1 },
    ]);
  });

  it("lets a card hold go once the page has run out", () => {
    expect(piecesTaken([[order({ awaitingPayment: true, submittedAt: minutesBefore(46) })]], NOW)).toEqual([]);
  });

  it("lets a hold go the moment Stripe closes the page", () => {
    const history = [order({ awaitingPayment: true }), order({ status: "closed", source: "stripe" })];
    expect(piecesTaken([history], NOW)).toEqual([]);
  });

  it("holds a piece for days while the bank is still sending the money", () => {
    const history = [
      order({ awaitingPayment: true, submittedAt: minutesBefore(3 * 24 * 60) }),
      order({ awaitingPayment: "bank", source: "stripe", submittedAt: minutesBefore(3 * 24 * 60) }),
    ];
    expect(piecesTaken([history], NOW)).toEqual([{ styleId: "sol", sizeId: "s", quantity: 1 }]);
  });

  it("lets a piece go when the bank refuses the money", () => {
    const history = [
      order({ awaitingPayment: true }),
      order({ awaitingPayment: "bank", source: "stripe" }),
      order({ source: "stripe", paymentFailed: true }),
    ];
    expect(piecesTaken([history], NOW)).toEqual([]);
  });

  it("still counts a refunded piece as sold, so Daysi decides whether it goes back on the rack", () => {
    const history = [order({ awaitingPayment: true }), paid(), paid({ status: "refunded" })];
    expect(piecesTaken([history], NOW)).toEqual([
      { styleId: "sol", sizeId: "s", quantity: 1, soldAt: minutesBefore(5) },
    ]);
  });

  it("never counts a piece being made to measure", () => {
    const history = [
      order({
        awaitingPayment: true,
        pieces: [
          { styleId: "sol", sizeId: "s", quantity: 1, madeToMeasure: true },
          { styleId: "sol", sizeId: "m", quantity: 2, madeToMeasure: false },
        ],
      }),
    ];
    expect(piecesTaken([history], NOW)).toEqual([{ styleId: "sol", sizeId: "m", quantity: 2 }]);
  });

  it("ignores an order written before pieces were recorded", () => {
    expect(piecesTaken([[order({ pieces: undefined, awaitingPayment: true })]], NOW)).toEqual([]);
  });

  it("ignores an order paid by hand in the office, which Daysi counts herself", () => {
    const history = [order(), order({ status: "paid", source: "office" })];
    expect(piecesTaken([history], NOW)).toEqual([]);
  });
});

describe("how many pieces are left", () => {
  const counted = "2026-09-20T12:00:00.000Z";
  const sold = (soldAt: string, quantity = 1): TakenPiece => ({ styleId: "sol", sizeId: "s", quantity, soldAt });
  const held = (quantity = 1): TakenPiece => ({ styleId: "sol", sizeId: "s", quantity });

  it("takes off a piece sold after Daysi counted", () => {
    expect(availableCount(2, counted, [sold("2026-09-20T13:00:00.000Z")], "sol", "s")).toBe(1);
  });

  it("leaves alone a piece sold before she counted, which her count already left out", () => {
    expect(availableCount(2, counted, [sold("2026-09-20T11:00:00.000Z")], "sol", "s")).toBe(2);
  });

  it("takes off a piece held in somebody's checkout, whenever she counted", () => {
    expect(availableCount(2, counted, [held()], "sol", "s")).toBe(1);
  });

  it("only takes off pieces of this garment in this size", () => {
    const other: TakenPiece[] = [
      { styleId: "luna", sizeId: "s", quantity: 1 },
      { styleId: "sol", sizeId: "m", quantity: 1 },
    ];
    expect(availableCount(2, counted, other, "sol", "s")).toBe(2);
  });

  it("never goes below none", () => {
    expect(availableCount(1, counted, [held(), sold("2026-09-20T13:00:00.000Z", 2)], "sol", "s")).toBe(0);
  });
});

describe("a cart asking for more than is on the rack", () => {
  const style = { id: "sol", slug: "sol", sizes: [{ sizeId: "s" as const, inStock: true, count: 1 }, { sizeId: "m" as const, inStock: true }] };

  it("is short when ready-made pieces in one size add up past the count", () => {
    const lines = [
      { styleSlug: "sol", sizeId: "s" as const, customize: false, quantity: 1 },
      { styleSlug: "sol", sizeId: "s" as const, customize: false, quantity: 1 },
    ];
    expect(stockShortfall(lines, [style])).toBe(true);
  });

  it("is not short for a piece made to measure, which is sewn for the order", () => {
    const lines = [
      { styleSlug: "sol", sizeId: "s" as const, customize: false, quantity: 1 },
      { styleSlug: "sol", sizeId: "s" as const, customize: true, quantity: 3 },
    ];
    expect(stockShortfall(lines, [style])).toBe(false);
  });

  it("is never short for a size Daysi has not counted", () => {
    expect(stockShortfall([{ styleSlug: "sol", sizeId: "m", customize: false, quantity: 5 }], [style])).toBe(false);
  });
});
