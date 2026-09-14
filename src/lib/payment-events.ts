import type Stripe from "stripe";
import { notifyOwner } from "./notify";
import { listRequests, saveRequest, type StoredRequest } from "./request-store";

/**
 * What a Stripe event does to the record it belongs to.
 *
 * Kept out of the webhook route so it can be tested the way the rest of the
 * store is, without standing up a request.
 *
 * `checkout.session.completed` is not proof of money. It says the client
 * finished the page; for a card that is the same moment the money moves, but
 * for a bank debit the funds follow days later, or never. So the session's
 * `payment_status` decides whether a completed page is a payment, and the two
 * `async_payment_*` events carry the bank's answer when it comes.
 */

/** The kinds a payment can belong to. Messages and sign-ups are never charged. */
const PAYABLE_KINDS = ["appointment", "order", "commission", "alteration"] as const;

export type MarkPaidOutcome = "marked" | "already-paid" | "unknown";
export type MarkExpiredOutcome = "closed" | "not-waiting" | "unknown";
export type MarkRefundedOutcome = "refunded" | "already-refunded" | "unknown";

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
 * Daysi gave the money back in Stripe's dashboard, in full. The refund is a
 * fact about money, so it is written on top of whatever the record says now,
 * even a status Daysi set by hand since; only a refund already written is
 * not written again. Nothing is sent to her: she is the one who refunded.
 */
export async function markRefunded(reference: string): Promise<MarkRefundedOutcome> {
  const current = versionsOf(reference).at(-1);
  if (!current) return "unknown";
  if (current.status === "refunded") return "already-refunded";

  const { awaitingPayment: _waiting, ...settled } = current;
  await saveRequest({ ...settled, status: "refunded", source: "stripe" });
  return "refunded";
}

/**
 * The payment page ran out with nobody paying. The record is closed so it
 * leaves the calendar, Trabajo's open list and the books; Daysi is not told,
 * because nothing happened. Only the client's own untouched line is closed:
 * once Stripe has written a payment, or Daysi has changed anything herself,
 * the dead page is not news and the record is left as it is.
 *
 * A bank payment that bounces closes the record the same way: the client's
 * line is still waiting, nothing was ever received, and the same guard keeps
 * a late failure off a record Stripe has since paid or Daysi has handled.
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

export type PaymentEventOutcome =
  | MarkPaidOutcome
  | MarkExpiredOutcome
  | MarkRefundedOutcome
  /** The page completed, but `payment_status` is not "paid": the bank has not sent the money. */
  | "not-paid-yet"
  /** Logged and left for the office, which knows what part of the order it covers. */
  | "partial-refund"
  /** Stripe's own fixtures, or a session this site did not create. */
  | "no-reference"
  /** An event type the site was not written for. */
  | "ignored";

function referenceOf(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.reference ?? session.client_reference_id ?? null;
}

/**
 * Applies one verified event to the store. The route verifies the signature
 * and hands the event here; nothing in this function trusts anything but the
 * event's own fields.
 */
export async function applyPaymentEvent(event: Stripe.Event): Promise<PaymentEventOutcome> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const reference = referenceOf(session);
      if (!reference) return "no-reference";
      if (session.payment_status !== "paid") {
        console.info(
          `[stripe] Session for ${reference} completed but not paid yet (${session.payment_status}); waiting for the bank.`,
        );
        return "not-paid-yet";
      }
      const outcome = await markPaid(reference);
      if (outcome === "unknown") console.warn(`[stripe] Paid session for unknown reference ${reference}.`);
      return outcome;
    }

    // The bank's answer, days after the page completed. Stripe only sends this
    // once the money is in, so there is no status to re-check.
    case "checkout.session.async_payment_succeeded": {
      const reference = referenceOf(event.data.object);
      if (!reference) return "no-reference";
      const outcome = await markPaid(reference);
      if (outcome === "unknown") console.warn(`[stripe] Bank payment for unknown reference ${reference}.`);
      return outcome;
    }

    // The client never paid and the page has closed. Bookings hold their slot
    // for only this long, so the record is closed and the hour goes back on offer.
    case "checkout.session.expired": {
      const reference = referenceOf(event.data.object);
      if (!reference) return "no-reference";
      const outcome = await markExpired(reference);
      if (outcome === "unknown") console.warn(`[stripe] Expired session for unknown reference ${reference}.`);
      return outcome;
    }

    // The bank refused the debit. Nothing was received, so the record is
    // closed exactly as an abandoned page is, and Daysi is not told.
    case "checkout.session.async_payment_failed": {
      const reference = referenceOf(event.data.object);
      if (!reference) return "no-reference";
      const outcome = await markExpired(reference);
      if (outcome === "closed") console.info(`[stripe] Bank payment for ${reference} failed; record closed.`);
      if (outcome === "unknown") console.warn(`[stripe] Failed bank payment for unknown reference ${reference}.`);
      return outcome;
    }

    // Money given back from Stripe's dashboard. The reference travels on the
    // charge because `payments.ts` stamps it on the payment intent. Only a full
    // refund changes the record: the site cannot say which part of an order a
    // partial one covers, so that stays Daysi's call in Trabajo.
    case "charge.refunded": {
      const charge = event.data.object;
      const reference = charge.metadata?.reference;
      if (!charge.refunded) {
        console.info(`[stripe] Partial refund on ${reference ?? charge.id}; left for the office.`);
        return "partial-refund";
      }
      if (!reference) return "no-reference";
      const outcome = await markRefunded(reference);
      if (outcome === "unknown") console.warn(`[stripe] Refund for unknown reference ${reference}.`);
      return outcome;
    }

    default:
      return "ignored";
  }
}
