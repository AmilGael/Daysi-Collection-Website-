import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyWebhook } from "@/lib/payments";
import { listRequests, saveRequest } from "@/lib/request-store";

/**
 * Stripe's confirmation that a payment really completed.
 *
 * This is the only place an order is marked paid. It is never trusted on the
 * word of a browser: the raw body is verified against Stripe's signature before
 * it is parsed, so a forged call cannot mark anything paid.
 *
 * The body must be read as raw text, not JSON — the signature is computed over
 * exact bytes.
 */
export async function POST(request: Request) {
  if (!env.stripeWebhookSecret) {
    return NextResponse.json({ error: "not-configured" }, { status: 501 });
  }

  const payload = await request.text();

  let event;
  try {
    event = verifyWebhook(payload, request.headers.get("stripe-signature"));
  } catch (error) {
    console.error("[stripe] Rejected an unverified webhook.", error);
    return NextResponse.json({ error: "bad-signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const reference = session.metadata?.reference ?? session.client_reference_id;
    if (reference) await markPaid(reference);
  }

  return NextResponse.json({ received: true });
}

/**
 * Appends the paid state for the reference. The store is append-only, so the
 * latest record for a reference is the current one.
 */
async function markPaid(reference: string): Promise<void> {
  for (const kind of ["appointment", "order", "commission", "alteration"] as const) {
    const records = listRequests(kind);
    const record = records.findLast((candidate) => candidate.reference === reference);
    if (!record) continue;
    await saveRequest({ ...record, status: "paid" });
    return;
  }
  console.warn(`[stripe] Paid session for unknown reference ${reference}.`);
}
