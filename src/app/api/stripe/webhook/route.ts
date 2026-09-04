import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyWebhook } from "@/lib/payments";
import { markPaid } from "@/lib/payment-events";

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
    if (reference && (await markPaid(reference)) === "unknown") {
      console.warn(`[stripe] Paid session for unknown reference ${reference}.`);
    }
  }

  return NextResponse.json({ received: true });
}
