import Stripe from "stripe";
import type { Locale } from "@/i18n/routing";
import { env, paymentsEnabled } from "./env";
import { CURRENCY } from "./money";
import type { Estimate } from "./pricing";

/**
 * Card handling.
 *
 * The site never sees a card number. Stripe Checkout is hosted on Stripe's own
 * domain, so card data goes from the client's browser straight to Stripe and
 * this application stays outside the scope that handling card data would put it
 * in. The only things crossing this boundary are amounts computed by
 * `pricing.ts` from the published price list, and a reference number.
 *
 * Apple Pay and Google Pay come with Checkout, which covers the tap-to-pay
 * experience Daysi asked for without a second integration.
 */

let client: Stripe | null = null;

function stripe(): Stripe {
  if (!env.stripeSecretKey) {
    throw new Error("Stripe is not configured; check `paymentsEnabled` before calling.");
  }
  client ??= new Stripe(env.stripeSecretKey, { apiVersion: "2025-08-27.basil" });
  return client;
}

export type CheckoutRequest = {
  readonly reference: string;
  readonly description: string;
  readonly estimate: Estimate;
  readonly customerEmail: string;
  readonly locale: Locale;
};

/**
 * Creates a Checkout session for the amount due now. The amount comes from the
 * server-built estimate; there is no code path that accepts a price from a
 * browser.
 */
export async function createCheckoutSession(
  request: CheckoutRequest,
): Promise<{ url: string } | null> {
  if (!paymentsEnabled) return null;
  if (request.estimate.dueNow <= 0) return null;

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    locale: request.locale,
    customer_email: request.customerEmail,
    client_reference_id: request.reference,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: request.estimate.dueNow,
          product_data: {
            name: request.description,
            description: request.estimate.dueNowReason[request.locale],
          },
        },
      },
    ],
    metadata: { reference: request.reference },
    success_url: `${env.siteUrl}/${request.locale}/checkout/thank-you?reference=${request.reference}`,
    cancel_url: `${env.siteUrl}/${request.locale}/checkout/cancelled?reference=${request.reference}`,
  });

  return session.url ? { url: session.url } : null;
}

/**
 * Verifies that a webhook really came from Stripe. An unsigned or mis-signed
 * body is rejected before it is parsed, so a forged "payment succeeded" call
 * cannot mark an order paid.
 */
export function verifyWebhook(payload: string, signature: string | null): Stripe.Event {
  if (!env.stripeWebhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set; refusing to trust the webhook.");
  }
  if (!signature) {
    throw new Error("Missing Stripe signature.");
  }
  return stripe().webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
}
