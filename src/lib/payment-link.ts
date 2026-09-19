import type { PaymentLink, StoredRequest } from "./request-store";

/**
 * The payment page Daysi made for a record, if the client can still pay it
 * right now. Client-safe: the office cards and the client's own order list
 * both ask this, and neither may import the store itself.
 */
export function openPaymentLink(
  record: Pick<StoredRequest, "paymentLink" | "status">,
  now: Date = new Date(),
): PaymentLink | null {
  const link = record.paymentLink;
  if (!link || record.status === "paid") return null;
  return Date.parse(link.expiresAt) > now.getTime() ? link : null;
}

/** The statuses a charge can be made on: work not yet settled one way or another. */
export function chargeable(record: Pick<StoredRequest, "status" | "kind">): boolean {
  if (record.kind === "contact" || record.kind === "premiere-signup") return false;
  return record.status === "new" || record.status === "answered" || record.status === "scheduled";
}
