import type Stripe from "stripe";
import { notifyClientPaid, notifyClientPaymentFailed, notifyOwner } from "./notify";
import { referenceOf } from "./payments";
import { listRequests, owesNothing, saveRequest, type StoredRequest } from "./request-store";
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
const PAYABLE_KINDS = ["appointment", "order", "commission", "alteration", "design"] as const;

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
export async function markPaid(
  reference: string,
  payment: { readonly via: "card" | "bank"; readonly at: string },
): Promise<MarkPaidOutcome> {
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
  if (paidByStripe(versions)) return "already-paid";

  // The spread would otherwise carry the office's mark onto a line the office
  // did not write, and the waiting mark onto a line that is no longer waiting.
  const { awaitingPayment: _waiting, paymentFailed: _failed, ...settled } = current;
  const paid: StoredRequest = {
    ...settled,
    status: "paid",
    source: "stripe",
    paidVia: payment.via,
    paidAt: payment.at,
  };
  await saveRequest(paid);
  await restore(reference, "the payment is seen");
  await notifyOwner(paid);
  await notifyClientPaid(paid);
  return "marked";
}

/**
 * What Stripe itself has written about this reference, anywhere in its
 * history. The question is never "what does the newest line say" — Daysi may
 * have set that herself, believing money had arrived, and a later line
 * carries her status forward — but "what did Stripe report".
 *
 * A reference is used once, by one checkout, so these facts are final: a
 * payment Stripe reported cannot un-happen, and a refusal cannot be undone
 * by a delivery Stripe repeats days later.
 */
function stripeWrote(
  versions: readonly StoredRequest[],
  fact: (version: StoredRequest) => boolean,
): boolean {
  return versions.some((version) => version.source === "stripe" && fact(version));
}

const paidByStripe = (versions: readonly StoredRequest[]): boolean =>
  stripeWrote(versions, (version) => version.status === "paid" && !version.paymentFailed);

const refusedByStripe = (versions: readonly StoredRequest[]): boolean =>
  stripeWrote(versions, (version) => version.paymentFailed === true);

const refundedByStripe = (versions: readonly StoredRequest[]): boolean =>
  stripeWrote(versions, (version) => version.status === "refunded");

/**
 * Brings a row Daysi had retired back into view, because an outcome she has
 * to act on landed on it. Kept off the path to the notification: the record
 * is already written by now, and a volume that refuses this write must not
 * also cost her the email, which a retried delivery would never send again.
 */
async function restore(reference: string, why: string): Promise<void> {
  try {
    if (!retiredSet("request").has(reference)) return;
    console.info(`[stripe] ${reference} was retired; restored so ${why}.`);
    await setRetired("request", reference, false);
  } catch (error) {
    console.error(`[stripe] Could not restore the retired row ${reference}.`, error);
  }
}

/**
 * The page completed but the money has not moved: a bank debit is in flight.
 * The promise is written down so that Trabajo, the client's own list and the
 * thank-you page all read one stored fact, and a bank payment on its way
 * never looks like a card page somebody abandoned. Nothing is sent to Daysi:
 * she hears about it from `markPaid`, when the money is actually in.
 */
export async function markBankPending(reference: string): Promise<MarkBankPendingOutcome> {
  const versions = versionsOf(reference);
  const current = versions.at(-1);
  if (!current) return "unknown";
  if (paidByStripe(versions) || refusedByStripe(versions)) return "not-waiting";
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
  const versions = versionsOf(reference);
  const current = versions.at(-1);
  if (!current) return "unknown";
  if (refundedByStripe(versions)) return "already-refunded";

  const { awaitingPayment: _waiting, paymentFailed: _failed, ...settled } = current;
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

  const { awaitingPayment: _waiting, paymentFailed: _failed, ...settled } = current;
  await saveRequest({ ...settled, status: "closed", source: "stripe" });
  return "closed";
}

/**
 * The bank refused the debit, days after the client was told the payment was
 * on its way. Nothing was received, and the client still owes the money, so
 * the record keeps the status it had rather than being closed: a closed row
 * tells Libros the matter is over and leaves Daysi nothing to chase. The
 * refusal is written on the line, she is told, and so is the client, whom
 * silence would leave waiting for a piece nobody is making.
 *
 * Only a payment Stripe itself wrote counts as already settled. A Pagado
 * Daysi set by hand, believing the bank had sent the money, is exactly the
 * record this has to correct — so the refusal is recorded and she is told,
 * and the row carries both her status and the refusal until she settles it.
 *
 * A record already marked refused is left alone, so a retried delivery
 * tells nobody twice.
 */
export async function markFailed(reference: string): Promise<MarkFailedOutcome> {
  const versions = versionsOf(reference);
  const current = versions.at(-1);
  if (!current) return "unknown";
  if (paidByStripe(versions) || !current.awaitingPayment) return "not-waiting";
  // She has already settled the matter herself. A refusal written on top
  // would claim money was given back, or closed out, that never came in.
  if (owesNothing(current.status)) return "not-waiting";

  const { awaitingPayment: _waiting, ...rest } = current;
  const failed: StoredRequest = { ...rest, source: "stripe", paymentFailed: true };
  await saveRequest(failed);
  await restore(reference, "the refusal is seen");
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

/**
 * The money's own time, not the time this delivery happened to be handled.
 * Stripe retries for up to three days, and a retry must not move a payment
 * into the wrong month of the books.
 */
function paidAt(event: Stripe.Event): string {
  const seconds = event.created;
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
}

/**
 * A delivery that names no order at all: Stripe's own fixtures, or a session
 * this site did not create. Logged rather than dropped, because a live
 * session that lost its reference is the one case worth chasing.
 */
function nameless(event: Stripe.Event): "no-reference" {
  console.warn(`[stripe] ${event.type} ${event.id} named no order; nothing written.`);
  return "no-reference";
}

/**
 * One line per delivery, naming the event, its id and the order it moved.
 * Several marks answer "not-waiting" for different reasons, so without the
 * reference there is no way to tell a correctly skipped duplicate from a
 * write that was wrongly skipped.
 */
function logged<Outcome extends string>(outcome: Outcome, event: Stripe.Event, reference: string): Outcome {
  const line = `[stripe] ${event.type} ${event.id} for ${reference} -> ${outcome}`;
  if (outcome === "unknown") console.warn(line);
  else console.info(line);
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
      if (!reference) return nameless(event);
      // "unpaid" on a completed page is a bank debit in flight. Anything else
      // ("paid", or "no_payment_required" for a session with nothing owed) is settled.
      if (session.payment_status === "unpaid") {
        return logged(await markBankPending(reference), event, reference);
      }
      return logged(await markPaid(reference, { via: "card", at: paidAt(event) }), event, reference);
    }

    // The bank's answer, days after the page completed. Stripe only sends this
    // once the money is in, so there is no status to re-check. The method
    // comes from the event: the record may not carry the promise yet, since
    // Stripe does not promise to deliver the completed page first.
    case "checkout.session.async_payment_succeeded": {
      const reference = referenceOf(event.data.object);
      if (!reference) return nameless(event);
      return logged(await markPaid(reference, { via: "bank", at: paidAt(event) }), event, reference);
    }

    // The bank refused the debit.
    case "checkout.session.async_payment_failed": {
      const reference = referenceOf(event.data.object);
      if (!reference) return nameless(event);
      return logged(await markFailed(reference), event, reference);
    }

    // The client never paid and the page has closed. Bookings hold their slot
    // for only this long, so the record is closed and the hour goes back on offer.
    case "checkout.session.expired": {
      const reference = referenceOf(event.data.object);
      if (!reference) return nameless(event);
      return logged(await markExpired(reference), event, reference);
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
      if (!reference) return nameless(event);
      return logged(await markRefunded(reference), event, reference);
    }

    default:
      return "ignored";
  }
}
