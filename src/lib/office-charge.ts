import type { Cents } from "@/content/types";
import { paymentsEnabled } from "./env";
import { chargeable, openPaymentLink } from "./payment-link";
import { createCheckoutSession, expireCheckoutSession } from "./payments";
import { chargeEstimate } from "./pricing";
import { notifyClientPaymentLink } from "./notify";
import { findRequest, saveRequest, type PaymentLink, type StoredRequest } from "./request-store";

/**
 * Charging a client from the office: Daysi names an amount on an order,
 * the site asks Stripe for a payment page, and she sends its address by
 * WhatsApp or email. The webhook writes the payment when it comes, exactly
 * as for an order paid on the site — the receipt, her notice, Libros.
 *
 * Stripe keeps a page open for at most a day, so the link says so; when it
 * runs out unpaid the webhook drops it and the order stays open, owed.
 */

/** A day is Stripe's ceiling for a Checkout page; an hour short leaves it room. */
export const CHARGE_LINK_MINUTES = 23 * 60;
/** The most any price in the office may be, as everywhere else she types one. */
export const MAX_CHARGE: Cents = 500_000;
export const MIN_CHARGE: Cents = 100;

export type ChargeOutcome =
  | { readonly ok: true; readonly link: PaymentLink }
  | {
      readonly ok: false;
      readonly error: "payments-off" | "unknown-reference" | "not-chargeable" | "bad-amount" | "old-link-open" | "stripe-failed";
    };

export async function chargeRecord(reference: string, amount: Cents): Promise<ChargeOutcome> {
  if (!paymentsEnabled) return { ok: false, error: "payments-off" };
  if (!Number.isInteger(amount) || amount < MIN_CHARGE || amount > MAX_CHARGE) {
    return { ok: false, error: "bad-amount" };
  }
  const current = findRequest(reference);
  if (!current) return { ok: false, error: "unknown-reference" };
  if (!chargeable(current)) return { ok: false, error: "not-chargeable" };

  // One open page per order, ever: the last one is closed before a new one
  // exists, so a client holding yesterday's link cannot pay twice. If Stripe
  // cannot say the old page is closed, no new one is made.
  if (openPaymentLink(current)) {
    const closed = await expireCheckoutSession(current.paymentLink!.sessionId, reference);
    if (closed !== "expired" && closed !== "not-open") return { ok: false, error: "old-link-open" };
  }

  const estimate = chargeEstimate(current.estimate, amount);
  let page;
  try {
    page = await createCheckoutSession({
      reference,
      description: `Daysi Collection · ${reference}`,
      estimate,
      customerEmail: current.client.email,
      locale: current.locale,
      expiresInMinutes: CHARGE_LINK_MINUTES,
      cardsOnly: true,
    });
  } catch (error) {
    console.warn(`[office] Stripe refused a payment page for ${reference}.`, error);
    page = null;
  }
  if (!page) return { ok: false, error: "stripe-failed" };

  const link: PaymentLink = { url: page.url, sessionId: page.id, amount, expiresAt: page.expiresAt };
  // `source: "office"` keeps the row in her Hub: a waiting mark with no source
  // is how a card page nobody finished on the site looks, and those are hidden.
  const { paymentFailed: _failed, ...rest } = current;
  const charged: StoredRequest = { ...rest, estimate, source: "office", awaitingPayment: true, paymentLink: link };
  await saveRequest(charged);
  return { ok: true, link };
}

export type SendLinkOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: "unknown-reference" | "no-link" | "no-email" | "email-failed" };

/** Emails the open link to the client. */
export async function emailPaymentLink(reference: string): Promise<SendLinkOutcome> {
  const current = findRequest(reference);
  if (!current) return { ok: false, error: "unknown-reference" };
  const link = openPaymentLink(current);
  if (!link) return { ok: false, error: "no-link" };
  if (!current.client.email) return { ok: false, error: "no-email" };
  return (await notifyClientPaymentLink(current, link)) ? { ok: true } : { ok: false, error: "email-failed" };
}
