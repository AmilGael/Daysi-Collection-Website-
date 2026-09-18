import type { SizeId } from "@/content";
import { holdExpired } from "./availability";
import { listRequests, owesNothing, type StoredRequest } from "./request-store";
import { retiredSet } from "./retired";

/**
 * How many pieces of a garment are on the rack, size by size.
 *
 * Daysi types a count; what the site sells from it is worked out, never
 * written: her number, less every piece held in somebody's checkout, less
 * every piece Stripe was paid for after she counted. Nothing is written
 * when a piece sells, because a written decrement would be undone by her
 * office undo, overwritten by a draft she had open, or taken twice by a
 * webhook Stripe repeats. Booking holds already work this way.
 *
 * A size she has never counted keeps the old on/off switch and never runs
 * out, so a garment is untouched until she gives it a number.
 */

/** A ready-made piece an order has taken: sold at `soldAt`, or, without it, held. */
export type TakenPiece = {
  readonly styleId: string;
  readonly sizeId: SizeId;
  readonly quantity: number;
  readonly soldAt?: string;
};

/**
 * Every piece the orders have taken, read from each order's whole history.
 * Sold means Stripe reported the money and no refusal followed; a refund
 * still counts as sold, since whether the piece goes back on the rack is
 * hers to say. Held means the payment page is open or the bank is still
 * sending, by the same clock that holds a booking's hour. A piece paid by
 * hand in the office is not counted here: she retypes the count herself.
 */
export function piecesTaken(
  histories: readonly (readonly StoredRequest[])[],
  now: Date,
): TakenPiece[] {
  return histories.flatMap((versions) => {
    const current = versions.at(-1);
    const pieces = versions.find((version) => version.pieces)?.pieces;
    if (!current || !pieces || current.paymentFailed) return [];

    const readyMade = pieces
      .filter((piece) => !piece.madeToMeasure)
      .map(({ styleId, sizeId, quantity }) => ({ styleId, sizeId, quantity }));

    const paid = versions.find(
      (version) => version.source === "stripe" && version.status === "paid" && !version.paymentFailed,
    );
    if (paid) return readyMade.map((piece) => ({ ...piece, soldAt: paid.paidAt ?? paid.submittedAt }));
    if (owesNothing(current.status) || !current.awaitingPayment) return [];
    return holdExpired(current, now) ? [] : readyMade;
  });
}

/**
 * What is left of a count typed at `countedAt`. A piece sold before then was
 * already off the rack when she counted; a held piece is still on it, but
 * spoken for, whenever she counted.
 */
export function availableCount(
  count: number,
  countedAt: string | undefined,
  taken: readonly TakenPiece[],
  styleId: string,
  sizeId: SizeId,
): number {
  let left = count;
  for (const piece of taken) {
    if (piece.styleId !== styleId || piece.sizeId !== sizeId) continue;
    if (piece.soldAt === undefined || countedAt === undefined || piece.soldAt > countedAt) {
      left -= piece.quantity;
    }
  }
  return Math.max(0, left);
}

type CountedStyle = {
  readonly id: string;
  readonly slug: string;
  readonly sizes: readonly { readonly sizeId: SizeId; readonly count?: number }[];
};
type AskedLine = {
  readonly styleSlug: string;
  readonly sizeId: SizeId;
  readonly customize: boolean;
  readonly quantity: number;
};

/**
 * True when the ready-made lines ask for more of a counted size than is
 * left. Lines for the same garment and size are added up first, since a
 * cart can hold the same piece twice. Made to measure is sewn for the order
 * and never short.
 */
export function stockShortfall(lines: readonly AskedLine[], styles: readonly CountedStyle[]): boolean {
  const asked = new Map<string, number>();
  for (const line of lines) {
    if (line.customize) continue;
    const key = `${line.styleSlug}|${line.sizeId}`;
    asked.set(key, (asked.get(key) ?? 0) + line.quantity);
  }
  for (const [key, quantity] of asked) {
    const [slug, sizeId] = key.split("|");
    const count = styles
      .find((style) => style.slug === slug)
      ?.sizes.find((size) => size.sizeId === sizeId)?.count;
    if (count !== undefined && quantity > count) return true;
  }
  return false;
}

/**
 * The pieces every live order has taken, right now. A retired order is gone
 * from the books, and from the rack's reckoning with it.
 */
export function takenFromOrders(now: Date = new Date()): TakenPiece[] {
  const retired = retiredSet("request");
  const histories = new Map<string, StoredRequest[]>();
  for (const line of listRequests("order")) {
    if (retired.has(line.reference)) continue;
    histories.set(line.reference, [...(histories.get(line.reference) ?? []), line]);
  }
  return piecesTaken([...histories.values()], now);
}
