import { NextResponse } from "next/server";
import { z } from "zod";
import { findStyle, translate } from "@/content";
import { emptyCart, readCart, writeCart } from "@/lib/cart";
import { estimateCart } from "@/lib/pricing";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin, newReference } from "@/lib/security";
import { recordRequest } from "@/lib/notify";
import { createCheckoutSession } from "@/lib/payments";
import { paymentsEnabled } from "@/lib/env";
import { currentViewer } from "@/lib/auth/session";
import { findOrCreateAccount } from "@/lib/auth/accounts";
import type { StoredRequest } from "@/lib/request-store";

/**
 * Turns a cart into an order.
 *
 * The basket is re-priced here from the published list — the client's cookie
 * says what they chose, this decides what it costs — and the order is written
 * against an account, so it appears in "my orders" whether the person was
 * signed in when they filled the cart or signed in at the till.
 */

const CHECKOUTS_PER_HOUR = 8;
const ONE_HOUR = 3600;

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().max(160).email(),
  phone: z.string().trim().min(7).max(30).regex(/^[0-9+()\-.\s]+$/),
  preferredContact: z.enum(["whatsapp", "phone", "email"]),
  locale: z.enum(["es", "en"]),
  notes: z.string().trim().max(2000).optional().default(""),
  acceptedTerms: z.literal(true),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
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

  const cart = await readCart();
  const estimate = estimateCart(cart.lines);
  if (!estimate) {
    return NextResponse.json({ error: "empty-cart" }, { status: 400 });
  }

  const details = parsed.data;

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

  const reference = newReference("ORD");
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
      preferredContact: details.preferredContact,
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
    status: "new",
  };

  const delivered = await recordRequest(record);
  if (!delivered) {
    return NextResponse.json({ error: "not-recorded" }, { status: 500 });
  }

  // The cart is emptied only once the order is safely recorded.
  await writeCart(emptyCart);

  const checkout = paymentsEnabled
    ? await createCheckoutSession({
        reference,
        description: `Daysi Collection · ${reference}`,
        estimate,
        customerEmail: account.email,
        locale: details.locale,
      })
    : null;

  return NextResponse.json({ reference, estimate, checkoutUrl: checkout?.url });
}
