import { notifyOwner } from "./notify";
import { listRequests, saveRequest, type StoredRequest } from "./request-store";

/**
 * What a completed Stripe payment does to the record it belongs to.
 *
 * Kept out of the webhook route so it can be tested the way the rest of the
 * store is, without standing up a request.
 */

/** The kinds a payment can belong to. Messages and sign-ups are never charged. */
const PAYABLE_KINDS = ["appointment", "order", "commission", "alteration"] as const;

export type MarkPaidOutcome = "marked" | "already-paid" | "unknown";
export type MarkExpiredOutcome = "closed" | "not-waiting" | "unknown";

function versionsOf(reference: string): StoredRequest[] {
  for (const kind of PAYABLE_KINDS) {
    const versions = listRequests(kind).filter((candidate) => candidate.reference === reference);
    if (versions.length > 0) return versions;
  }
  return [];
}

/**
 * Appends the paid state for the reference, and tells Daysi. The store is
 * append-only, so the latest record for a reference is the current one.
 *
 * This is where a card-paid order reaches her inbox: not when the form was
 * filled in, but when Stripe says the money arrived. A retried delivery
 * returns early above the notification, so she is told once.
 */
export async function markPaid(reference: string): Promise<MarkPaidOutcome> {
  const versions = versionsOf(reference);
  const current = versions.at(-1);
  if (current) {
    // Stripe retries a delivery it believes failed, for up to three days, and
    // the question is whether this payment has been written down before — not
    // whether the newest line happens to be it. If Daysi has since corrected the
    // record, closing an order she refunded, say, then the newest line is hers,
    // and marking it paid again would quietly put the money back in the books.
    // One payment, one line. Her own marks are untouched: this only refuses to
    // repeat a line Stripe already wrote.
    if (versions.some((version) => version.status === "paid" && version.source === "stripe")) {
      return "already-paid";
    }

    // The spread would otherwise carry the office's mark onto a line the office
    // did not write, and the waiting mark onto a line that is no longer waiting.
    const { awaitingPayment: _waiting, ...settled } = current;
    const paid: StoredRequest = { ...settled, status: "paid", source: "stripe" };
    await saveRequest(paid);
    await notifyOwner(paid);
    return "marked";
  }
  return "unknown";
}

/**
 * The payment page ran out with nobody paying. The record is closed so it
 * leaves the calendar, Trabajo's open list and the books; Daysi is not told,
 * because nothing happened. Only the client's own untouched line is closed:
 * once Stripe has written a payment, or Daysi has changed anything herself,
 * the dead page is not news and the record is left as it is.
 */
export async function markExpired(reference: string): Promise<MarkExpiredOutcome> {
  const current = versionsOf(reference).at(-1);
  if (!current) return "unknown";
  if (!current.awaitingPayment || current.source !== undefined || current.status === "paid") {
    return "not-waiting";
  }

  const { awaitingPayment: _waiting, ...settled } = current;
  await saveRequest({ ...settled, status: "closed", source: "stripe" });
  return "closed";
}
