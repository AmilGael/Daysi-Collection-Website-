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
  /**
   * Closes the payment page after this long (`CHECKOUT_HOLD_MINUTES`). A
   * booking's slot is only held that long; an order's page closes on the same
   * clock so a cart nobody paid for is closed within the hour, not the day.
   */
  readonly expiresInMinutes?: number;
  /**
   * Offer cards only. Set for bookings: a bank debit takes days to clear, so
   * a deposit paid that way could land after the hour had been given back to
   * the calendar. Cards carry Apple Pay and Google Pay with them. This is an
   * explicit list to Stripe, so it also leaves out Link and the other wallets
   * the dashboard may enable; orders keep whatever the dashboard allows.
   */
  readonly cardsOnly?: boolean;
};

/**
 * Stripe refuses an expiry under thirty minutes measured on its own clock.
 * The hold is exactly thirty, so the page is told a minute more: the rounding
 * of `Date.now()` and the request's own travel time must not decide it.
 */
const EXPIRY_MARGIN_SECONDS = 60;

/** How long the thank-you page waits for Stripe before it stops asking. */
const LOOKUP_TIMEOUT_MS = 5_000;

/** Stripe's own prefix for a Checkout session. A budget is not spent on anything else. */
export function isSessionId(value: string): boolean {
  return value.startsWith("cs_");
}

/** The order a Checkout session belongs to, or null for a session this site did not make. */
export function referenceOf(
  session: Pick<Stripe.Checkout.Session, "metadata" | "client_reference_id">,
): string | null {
  return session.metadata?.reference ?? session.client_reference_id ?? null;
}

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
    // One inline amount, already final. `pricing.ts` works out New York sales tax
    // itself (with the clothing exemption under $110) and folds it into `dueNow`,
    // so the tax is inside this number. Never add `automatic_tax` here, and leave
    // Stripe's own Tax settings switched off: either would charge it a second time
    // and put the dashboard at odds with the sales file `books.ts` writes.
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
    // The same reference on the payment intent, so it reaches the charge and any
    // refund made from it. Refunds are done by hand in Stripe's dashboard and the
    // site never hears about them, so the reference has to be visible there for
    // the order to be findable afterwards.
    payment_intent_data: { metadata: { reference: request.reference } },
    ...(request.expiresInMinutes
      ? {
          expires_at:
            Math.floor(Date.now() / 1000) + request.expiresInMinutes * 60 + EXPIRY_MARGIN_SECONDS,
        }
      : {}),
    ...(request.cardsOnly ? { payment_method_types: ["card" as const] } : {}),
    // Stripe fills in the braces with the session's id, so the thank-you page
    // can ask whether the money is actually in before it says so, and the
    // cancelled page can close the payment page the client backed out of.
    success_url: `${env.siteUrl}/${request.locale}/checkout/thank-you?reference=${request.reference}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.siteUrl}/${request.locale}/checkout/cancelled?reference=${request.reference}&session_id={CHECKOUT_SESSION_ID}`,
  });

  return session.url ? { url: session.url } : null;
}

export type CheckoutPaymentStatus = "paid" | "pending" | "unknown";

/**
 * What Stripe says about a session, for the thank-you page in the moment
 * before the webhook has written anything. "pending" is a completed page whose
 * bank debit has not cleared; "unknown" is everything the page must not build
 * a promise on: an id that could not be a session, a session for another
 * order, a page still open or expired, Stripe switched off, Stripe slow or
 * unreachable. The call is given one short try, because the client is waiting
 * on it and the books are written by the webhook, never by this lookup.
 */
export async function checkoutPaymentStatus(
  sessionId: string,
  reference: string,
): Promise<CheckoutPaymentStatus> {
  if (!paymentsEnabled) return "unknown";
  if (!isSessionId(sessionId)) return "unknown";
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId, {
      timeout: LOOKUP_TIMEOUT_MS,
      maxNetworkRetries: 0,
    });
    // A hand-edited URL must not show one order's state under another's number.
    if (referenceOf(session) !== reference) return "unknown";
    if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
      return "paid";
    }
    return session.status === "complete" ? "pending" : "unknown";
  } catch (error) {
    console.warn(`[stripe] Could not read session ${sessionId} for the thank-you page.`, error);
    return "unknown";
  }
}

export type ExpireOutcome = "expired" | "not-open" | "mismatch" | "unknown";

/**
 * Closes the payment page a client backed out of, for the cancelled page.
 * Without this the page stays payable, and the order stays waiting, until
 * Stripe closes it on its own half an hour later.
 *
 * "expired" is a page this call closed; "not-open" is one Stripe had already
 * closed, found either on the look or by the close being refused. Both mean
 * nothing can be paid on it any more. "mismatch" is a session made for
 * another order, and is left alone. "unknown" covers Stripe switched off,
 * an id that could not be a session, Stripe slow or unreachable, and a
 * completed page: that one may be a bank debit on its way, and the webhook,
 * not this page, writes what it became. One short try, as on the thank-you
 * page, because the client is waiting on it.
 */
export async function expireCheckoutSession(
  sessionId: string,
  reference: string,
): Promise<ExpireOutcome> {
  if (!paymentsEnabled) return "unknown";
  if (!isSessionId(sessionId)) return "unknown";
  const once = { timeout: LOOKUP_TIMEOUT_MS, maxNetworkRetries: 0 };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId, once);
  } catch (error) {
    // Including a made-up id Stripe has never heard of: that proves nothing
    // about the order, so nothing is closed on its word.
    console.warn(`[stripe] Could not read session ${sessionId} for the cancelled page.`, error);
    return "unknown";
  }
  // A hand-edited URL must not close one order under another's number.
  if (referenceOf(session) !== reference) return "mismatch";
  if (session.status === "expired") return "not-open";
  if (session.status !== "open") return "unknown";

  try {
    await stripe().checkout.sessions.expire(sessionId, {}, once);
    return "expired";
  } catch (error) {
    // Stripe refuses to expire a page that is no longer open: it ran out
    // between the look and the close. A timeout or a dropped connection says
    // nothing about the page.
    if ((error as { type?: unknown } | null)?.type === "StripeInvalidRequestError") return "not-open";
    console.warn(`[stripe] Could not close session ${sessionId} for the cancelled page.`, error);
    return "unknown";
  }
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
