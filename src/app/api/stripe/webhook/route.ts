import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyWebhook } from "@/lib/payments";
import { applyPaymentEvent } from "@/lib/payment-events";

/**
 * Stripe's confirmation that a payment really completed.
 *
 * This is the only place an order is marked paid. It is never trusted on the
 * word of a browser: the raw body is verified against Stripe's signature before
 * it is parsed, so a forged call cannot mark anything paid. Nor is it trusted
 * on `checkout.session.completed` alone: for a bank payment that event arrives
 * before the money, and `payment-events.ts` waits for `payment_status` to say
 * paid, or for the bank's own later answer.
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

  const outcome = await applyPaymentEvent(event);

  return NextResponse.json({ received: true, outcome });
}
