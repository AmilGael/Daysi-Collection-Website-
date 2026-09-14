import { checkoutPaymentStatus } from "./payments";
import { checkRateLimit } from "./rate-limit";
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
  if (record.status === "paid") return "paid";
  if (record.paymentFailed) return "failed";
  if (record.awaitingPayment === "bank") return "pending";
  if (record.awaitingPayment !== true) return "unknown";

  if (typeof input.sessionId !== "string") return "unknown";
  if (!checkRateLimit(`thank-you:${input.caller}`, LOOKUPS_PER_HOUR, ONE_HOUR).allowed) {
    return "unknown";
  }
  return checkoutPaymentStatus(input.sessionId, input.reference);
}
