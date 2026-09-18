import { NextResponse } from "next/server";
import { z } from "zod";
import { translate } from "@/content";
import { liveStyleBySlug as findStyle, liveStyles } from "@/lib/live-catalog";
import { stockShortfall } from "@/lib/stock";
import { CHECKOUT_HOLD_MINUTES } from "@/lib/availability";
import { emptyCart, readCart, writeCart } from "@/lib/cart";
import { estimateCart } from "@/lib/pricing";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin, newReference } from "@/lib/security";
import { recordRequest } from "@/lib/notify";
import { createCheckoutSession } from "@/lib/payments";
import { markExpired } from "@/lib/payment-events";
import { paymentsEnabled } from "@/lib/env";
import { currentViewer } from "@/lib/auth/session";
import { findOrCreateAccount } from "@/lib/auth/accounts";
import { clientSchema, resolvePreferredContact } from "@/lib/validation";
import type { StoredRequest } from "@/lib/request-store";

/**
 * Turns a cart into an order.
 *
 * The basket is re-priced here from the published list — the client's cookie
 * says what they chose, this decides what it costs — and the order is written
 * against an account, so it appears in "my orders" whether the person was
 * signed in when they filled the cart or signed in at the till.
 *
 * Only a paid checkout becomes an order. Without Stripe there is no way to
 * pay, so nothing is written at all and the cart page points to WhatsApp;
 * with it, the record waits on the payment page and Daysi hears of it only
 * when Stripe confirms the money.
 */

const CHECKOUTS_PER_HOUR = 8;
const ONE_HOUR = 3600;

/**
 * One checkout at a time between reading the rack and holding its pieces, so
 * two clients reaching for the last one cannot both have it. The site runs on
 * one machine, so a lock in this module is the whole of it.
 */
let rack: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const turn = rack.then(task);
  rack = turn.catch(() => undefined);
  return turn;
}

const schema = z.object({
  ...clientSchema.shape,
  notes: z.string().trim().max(2000).optional().default(""),
  acceptedTerms: z.literal(true),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  if (!paymentsEnabled) {
    return NextResponse.json({ error: "payments-off" }, { status: 503 });
  }

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "checkout"), CHECKOUTS_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const details = parsed.data;

  // A guest may leave no phone at all — only the email is required — but
  // asking to be reached by phone or WhatsApp with none on file is refused
  // rather than silently ignored.
  const contact = resolvePreferredContact(details);
  if (!contact) {
    return NextResponse.json({ error: "phone-required" }, { status: 400 });
  }

  const cart = await readCart();
  const estimate = estimateCart(cart.lines);
  if (!estimate) {
    return NextResponse.json({ error: "empty-cart" }, { status: 400 });
  }

  // A signed-in viewer owns the order regardless of what the form said, so one
  // client cannot file an order onto another client's account by typing their
  // address into the email field.
  const viewer = await currentViewer();
  const account =
    viewer?.account ??
    (await findOrCreateAccount({
      email: details.email,
      name: details.name,
      locale: details.locale,
    }));

  const outcome = await oneAtATime(async () => {
    // Read again at the till: a piece may have sold while it sat in the cart.
    // Recording the order is what holds its pieces, so both happen in one turn.
    if (stockShortfall(cart.lines, liveStyles())) return null;

    const reference = newReference("ORD");
    // With money due, the client is about to be sent to pay. Daysi must not
    // hear about the order until that payment is confirmed, or a checkout
    // abandoned on the card page reads exactly like a sale.
    const awaitingPayment = estimate.dueNow > 0;
    const record: StoredRequest = {
      reference,
      kind: "order",
      submittedAt: new Date().toISOString(),
      locale: details.locale,
      accountId: account.id,
      client: {
        name: viewer ? viewer.account.name || details.name : details.name,
        email: account.email,
        phone: details.phone,
        preferredContact: contact.preferredContact,
      },
      details: {
        Pieces: cart.lines.map((line) => {
          const style = findStyle(line.styleSlug);
          const name = style ? translate(style.name, "en") : line.styleSlug;
          return `${name} · ${line.sizeId.toUpperCase()} × ${line.quantity}${
            line.customize ? " · made to measure" : ""
          }`;
        }),
        Notes: details.notes,
      },
      estimate,
      // Garment by size, for the stock: held while the payment is on its way,
      // sold once Stripe says so.
      pieces: cart.lines.flatMap((line) => {
        const style = findStyle(line.styleSlug);
        return style
          ? [{ styleId: style.id, sizeId: line.sizeId, quantity: line.quantity, madeToMeasure: line.customize }]
          : [];
      }),
      ...(awaitingPayment ? { awaitingPayment: true as const } : {}),
      status: "new",
    };

    return { reference, awaitingPayment, delivered: await recordRequest(record) };
  });

  if (!outcome) {
    return NextResponse.json({ error: "sold-out" }, { status: 409 });
  }
  if (!outcome.delivered) {
    return NextResponse.json({ error: "not-recorded" }, { status: 500 });
  }
  const { reference, awaitingPayment } = outcome;

  // Nothing due now (a garment priced at nothing): there is no payment to
  // wait for, so the order is already a real one and Daysi has been told.
  if (!awaitingPayment) {
    await writeCart(emptyCart);
    return NextResponse.json({ reference, estimate });
  }

  const checkout = await createCheckoutSession({
    reference,
    description: `Daysi Collection · ${reference}`,
    estimate,
    customerEmail: account.email,
    locale: details.locale,
    // Closed after half an hour, so an abandoned cart is closed too. Bank
    // debits stay on offer: they finish the page at once and settle later.
    expiresInMinutes: CHECKOUT_HOLD_MINUTES,
  }).catch((error: unknown) => {
    console.error(`[stripe] Could not open a payment page for ${reference}.`, error);
    return null;
  });

  if (!checkout) {
    // No page to send the client to. The record never reached Daysi and no
    // webhook will ever come for it, so it is closed here as a page that ran
    // out would be: every list already leaves it out, and closing it gives
    // back the pieces it held, so trying again can have them. The cart stays.
    await markExpired(reference);
    return NextResponse.json({ error: "checkout-unavailable", reference }, { status: 502 });
  }

  // The cart is emptied only once there is a payment page to send it to.
  await writeCart(emptyCart);
  return NextResponse.json({ reference, estimate, checkoutUrl: checkout.url });
}
