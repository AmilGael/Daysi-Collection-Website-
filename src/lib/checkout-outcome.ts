import { markExpired } from "./payment-events";
import { checkoutPaymentStatus, expireCheckoutSession, isSessionId } from "./payments";
import { checkRateLimit, pruneRateLimits } from "./rate-limit";
import { findRequest } from "./request-store";

/**
 * What the thank-you page is allowed to say.
 *
 * The store is the first word. The webhook writes what Stripe confirmed —
 * paid, a bank debit on its way, a debit refused — and the page reads that,
 * so a bounced payment can never keep reading "on its way" and a client
 * never pays Stripe's latency for a fact the site already holds. Stripe is
 * asked only in the gap before the webhook has landed, when the record still
 * carries the client's own waiting mark, and only a few times an hour from
 * one address: the page is public, and each ask is a live call on Daysi's
 * account.
 */

export type ThankYouState = "paid" | "pending" | "failed" | "unknown";

/** Lookups one address may make in an hour. A client refreshing twice is well inside it. */
export const LOOKUPS_PER_HOUR = 6;
const ONE_HOUR = 60 * 60;

export async function thankYouState(input: {
  readonly reference: string;
  readonly sessionId?: string | string[];
  readonly caller: string;
}): Promise<ThankYouState> {
  const record = findRequest(input.reference);
  if (!record) return "unknown";
  // A refusal is the last word on money, whatever status the line carries:
  // it keeps whatever the row said, which may be a Pagado she set by hand.
  if (record.paymentFailed) return "failed";
  // Only a payment Stripe wrote is a payment. A Pagado Daysi set by hand
  // after taking cash must not promise this client a receipt by email.
  if (record.status === "paid") return record.source === "stripe" ? "paid" : "unknown";
  if (record.awaitingPayment === "bank") return "pending";
  if (record.awaitingPayment !== true) return "unknown";

  // Nothing below reaches Stripe unless it could actually answer, so a
  // lookup that would be refused out of hand costs no part of the budget.
  if (typeof input.sessionId !== "string" || !isSessionId(input.sessionId)) return "unknown";
  pruneRateLimits();
  if (!checkRateLimit(input.caller, LOOKUPS_PER_HOUR, ONE_HOUR).allowed) return "unknown";
  return checkoutPaymentStatus(input.sessionId, input.reference);
}

export type CancelledState = "closed" | "already-closed" | "unknown";

/**
 * What the cancelled page does: the client pressed Stripe's back arrow, so the
 * payment page is closed there and then, and the order with it. Otherwise the
 * page stays payable, and the order sits in the client's own history as
 * waiting for payment, until Stripe's own expiry half an hour later.
 *
 * Only the client's own untouched waiting line is closed, through the same
 * `markExpired` the webhook uses, so the `checkout.session.expired` delivery
 * that follows finds nothing waiting and writes nothing. "already-closed" is
 * a record Stripe or Daysi has already written an outcome on, left as it is.
 * The page is public and each close is a live call on Daysi's account, so it
 * is held to the thank-you page's number of lookups an hour per address.
 */
export async function cancelledState(input: {
  readonly reference: string;
  readonly sessionId?: string | string[];
  readonly caller: string;
}): Promise<CancelledState> {
  const record = findRequest(input.reference);
  if (!record) return "unknown";
  if (record.awaitingPayment !== true || record.source !== undefined) return "already-closed";

  // As above: a close that could not be made costs no part of the budget.
  if (typeof input.sessionId !== "string" || !isSessionId(input.sessionId)) return "unknown";
  pruneRateLimits();
  if (!checkRateLimit(input.caller, LOOKUPS_PER_HOUR, ONE_HOUR).allowed) return "unknown";

  const expired = await expireCheckoutSession(input.sessionId, input.reference);
  // A mismatched session, or Stripe unable to say: the record is left for the webhook.
  if (expired !== "expired" && expired !== "not-open") return "unknown";
  const closed = await markExpired(input.reference);
  return closed === "closed" ? "closed" : closed === "not-waiting" ? "already-closed" : "unknown";
}
