import { listRequests, saveRequest } from "./request-store";

/**
 * What a completed Stripe payment does to the record it belongs to.
 *
 * Kept out of the webhook route so it can be tested the way the rest of the
 * store is, without standing up a request.
 */

/** The kinds a payment can belong to. Messages and sign-ups are never charged. */
const PAYABLE_KINDS = ["appointment", "order", "commission", "alteration"] as const;

export type MarkPaidOutcome = "marked" | "already-paid" | "unknown";

/**
 * Appends the paid state for the reference. The store is append-only, so the
 * latest record for a reference is the current one.
 */
export async function markPaid(reference: string): Promise<MarkPaidOutcome> {
  for (const kind of PAYABLE_KINDS) {
    const versions = listRequests(kind).filter((candidate) => candidate.reference === reference);
    const current = versions.at(-1);
    if (!current) continue;

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

    // The spread would otherwise carry the office's mark onto a line the office did not write.
    await saveRequest({ ...current, status: "paid", source: "stripe" });
    return "marked";
  }
  return "unknown";
}
