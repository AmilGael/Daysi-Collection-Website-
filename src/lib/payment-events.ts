import type Stripe from "stripe";
import { notifyClientPaymentFailed, notifyOwner } from "./notify";
import { referenceOf } from "./payments";
import { listRequests, saveRequest, type StoredRequest } from "./request-store";
import { retiredSet, setRetired } from "./retired";

/**
 * What a Stripe event does to the record it belongs to.
 *
 * Kept out of the webhook route so it can be tested the way the rest of the
 * store is, without standing up a request.
 *
 * `checkout.session.completed` is not proof of money. It says the client
 * finished the page; for a card that is the same moment the money moves, but
 * for a bank debit the funds follow days later, or never. So the session's
 * `payment_status` decides whether a completed page is a payment or a
 * promise, the promise is written down so the office and the client's own
 * pages can see it, and the two `async_payment_*` events carry the bank's
 * answer when it comes.
 */

/** The kinds a payment can belong to. Messages and sign-ups are never charged. */
const PAYABLE_KINDS = ["appointment", "order", "commission", "alteration"] as const;

export type MarkPaidOutcome = "marked" | "already-paid" | "unknown";
export type MarkExpiredOutcome = "closed" | "not-waiting" | "unknown";
export type MarkRefundedOutcome = "refunded" | "already-refunded" | "unknown";
export type MarkBankPendingOutcome = "bank-pending" | "already-pending" | "not-waiting" | "unknown";
export type MarkFailedOutcome = "failed" | "not-waiting" | "unknown";

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
 * This is where a paid order reaches her inbox: not when the form was filled
 * in, but when Stripe says the money arrived. A retried delivery returns
 * early above the notification, so she is told once. A row she had retired
 * while the bank was still sending is brought back: money that arrived must
 * be seen, and Libros counts only the rows in view.
 */
export async function markPaid(reference: string): Promise<MarkPaidOutcome> {
  const versions = versionsOf(reference);
  const current = versions.at(-1);
  if (!current) return "unknown";

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
  const { awaitingPayment: waiting, paymentFailed: _failed, ...settled } = current;
  const paidVia = waiting === "bank" ? "bank" : "card";
  const paid: StoredRequest = { ...settled, status: "paid", source: "stripe", paidVia, paidAt: new Date().toISOString() };
  await saveRequest(paid);
  if (retiredSet("request").has(reference)) {
    console.info(`[stripe] ${reference} was retired; restored so the payment is seen.`);
    await setRetired("request", reference, false);
  }
  await notifyOwner(paid);
  return "marked";
}

/**
 * The page completed but the money has not moved: a bank debit is in flight.
 * The promise is written down so that Trabajo, the client's own list and the
 * thank-you page all read one stored fact, and a bank payment on its way
 * never looks like a card page somebody abandoned. Nothing is sent to Daysi:
 * she hears about it from `markPaid`, when the money is actually in.
 */
export async function markBankPending(reference: string): Promise<MarkBankPendingOutcome> {
  const current = versionsOf(reference).at(-1);
  if (!current) return "unknown";
  if (current.status === "paid" || current.paymentFailed) return "not-waiting";
  if (current.awaitingPayment === "bank") return "already-pending";

  await saveRequest({ ...current, awaitingPayment: "bank", source: "stripe" });
  return "bank-pending";
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
 * once Stripe has written anything, or Daysi has changed anything herself,
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

/**
 * The bank refused the debit, days after the client was told the payment was
 * on its way. Nothing was received, so the record is closed like an abandoned
 * page, unless Daysi has already taken it in hand, in which case her status
 * stands. Either way the refusal is written on the line, she is told, and so
 * is the client: a silent close here would leave them waiting for a piece
 * nobody is making. A record already paid, or already marked refused, is
 * left alone, so a retried delivery tells nobody twice.
 */
export async function markFailed(reference: string): Promise<MarkFailedOutcome> {
  const current = versionsOf(reference).at(-1);
  if (!current) return "unknown";
  if (current.status === "paid" || !current.awaitingPayment) return "not-waiting";

  const { awaitingPayment: _waiting, ...rest } = current;
  const failed: StoredRequest = {
    ...rest,
    status: current.source === "office" ? current.status : "closed",
    source: "stripe",
    paymentFailed: true,
  };
  await saveRequest(failed);
  await notifyOwner(failed);
  await notifyClientPaymentFailed(failed);
  return "failed";
}

export type PaymentEventOutcome =
  | MarkPaidOutcome
  | MarkExpiredOutcome
  | MarkRefundedOutcome
  | MarkBankPendingOutcome
  | MarkFailedOutcome
  /** Logged and left for the office, which knows what part of the order it covers. */
  | "partial-refund"
  /** Stripe's own fixtures, or a session this site did not create. */
  | "no-reference"
  /** An event type the site was not written for. */
  | "ignored";

/** Every mark answers "unknown" for a reference the store has never seen; one warning covers them. */
function warnIfUnknown<Outcome extends string>(outcome: Outcome, what: string, reference: string): Outcome {
  if (outcome === "unknown") console.warn(`[stripe] ${what} for unknown reference ${reference}.`);
  return outcome;
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
      // "unpaid" on a completed page is a bank debit in flight. Anything else
      // ("paid", or "no_payment_required" for a session with nothing owed) is settled.
      if (session.payment_status === "unpaid") {
        return warnIfUnknown(await markBankPending(reference), "Unpaid completed session", reference);
      }
      return warnIfUnknown(await markPaid(reference), "Paid session", reference);
    }

    // The bank's answer, days after the page completed. Stripe only sends this
    // once the money is in, so there is no status to re-check.
    case "checkout.session.async_payment_succeeded": {
      const reference = referenceOf(event.data.object);
      if (!reference) return "no-reference";
      return warnIfUnknown(await markPaid(reference), "Bank payment", reference);
    }

    // The bank refused the debit.
    case "checkout.session.async_payment_failed": {
      const reference = referenceOf(event.data.object);
      if (!reference) return "no-reference";
      return warnIfUnknown(await markFailed(reference), "Failed bank payment", reference);
    }

    // The client never paid and the page has closed. Bookings hold their slot
    // for only this long, so the record is closed and the hour goes back on offer.
    case "checkout.session.expired": {
      const reference = referenceOf(event.data.object);
      if (!reference) return "no-reference";
      return warnIfUnknown(await markExpired(reference), "Expired session", reference);
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
      return warnIfUnknown(await markRefunded(reference), "Refund", reference);
    }

    default:
      return "ignored";
  }
}
