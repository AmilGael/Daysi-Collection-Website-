import { NextResponse } from "next/server";
import { silhouettes } from "@/content/silhouettes";
import { CHECKOUT_HOLD_MINUTES } from "@/lib/availability";
import { liveFindFabric } from "@/lib/live-pricing";
import { estimateDesign } from "@/lib/pricing";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin, newReference, parseImageDataUrl } from "@/lib/security";
import { recordRequest } from "@/lib/notify";
import { createCheckoutSession } from "@/lib/payments";
import { markExpired } from "@/lib/payment-events";
import { paymentsEnabled } from "@/lib/env";
import { currentViewer } from "@/lib/auth/session";
import { findOrCreateAccount } from "@/lib/auth/accounts";
import { designRequestSchema, isLikelyBot, resolvePreferredContact } from "@/lib/validation";
import { saveRequestPhoto, type StoredRequest } from "@/lib/request-store";

/**
 * A design from the studio, sent to Daysi with its fee.
 *
 * The picture is the request: the mockup the client drew is stored beside the
 * record, shown in the Hub and attached to Daysi's email. The fee is paid
 * first, so the record waits on the payment page exactly as a cart order
 * does — Daysi hears of it from `markPaid`, when Stripe confirms the money,
 * and a client who stops at the card page has sent her nothing.
 *
 * The checks run in the request form's order — origin, rate limit, shape,
 * bots — and then the ones only this route has: there must be a way to pay,
 * a cloth still on the wall, and a picture that really is one. Nothing is
 * written until all of them pass.
 */

const DESIGNS_PER_HOUR = 4;
const ONE_HOUR = 3600;

/** What the card page calls the charge, in the client's language. */
const FEE_DESCRIPTION = {
  es: "Daysi Collection · Tarifa de diseño",
  en: "Daysi Collection · Design fee",
} as const;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "designs"), DESIGNS_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = designRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const submission = parsed.data;

  // Silently accept and discard: a bot told it failed simply tries again.
  if (isLikelyBot(submission)) {
    return NextResponse.json({ reference: newReference("DSN") });
  }

  // The fee is what sends the design, so with no way to take it there is no
  // request to record. The studio shows its own note instead of the form.
  if (!paymentsEnabled) {
    return NextResponse.json({ error: "payments-off" }, { status: 503 });
  }

  // The silhouette is checked by the schema, since the studio's shapes are
  // coded; the cloth is one Daysi may have added or retired since the page
  // was drawn, so the live list answers for it.
  const silhouette = silhouettes.find((option) => option.id === submission.silhouetteId);
  const fabric = liveFindFabric(submission.fabricId);
  if (!silhouette || !fabric) {
    return NextResponse.json({ error: "unknown-fabric" }, { status: 400 });
  }

  // Unlike an alteration's optional photo, a bad picture here is not dropped
  // quietly: without it there is nothing for Daysi to quote on.
  const mockup = parseImageDataUrl(submission.mockupDataUrl);
  if (!mockup) {
    return NextResponse.json({ error: "bad-mockup" }, { status: 400 });
  }

  const reference = newReference("DSN");
  let photoFile: string;
  try {
    photoFile = await saveRequestPhoto(reference, mockup.mime, mockup.bytes);
  } catch (error) {
    console.error(`[store] Could not save the mockup for ${reference}`, error);
    return NextResponse.json({ error: "not-recorded" }, { status: 500 });
  }

  // A signed-in viewer owns the design regardless of what the form said, as
  // at the cart's till; a guest gets an account made from their email.
  const viewer = await currentViewer();
  const account =
    viewer?.account ??
    (await findOrCreateAccount({
      email: submission.email,
      name: submission.name,
      locale: submission.locale,
    }));

  // The form asks for no reply method: a number means WhatsApp, and an
  // email-only guest is answered by email.
  const contact = resolvePreferredContact({ phone: submission.phone });
  const estimate = estimateDesign();

  const record: StoredRequest = {
    reference,
    kind: "design",
    submittedAt: new Date().toISOString(),
    locale: submission.locale,
    accountId: account.id,
    client: {
      name: viewer ? viewer.account.name || submission.name : submission.name,
      email: account.email,
      phone: submission.phone,
      preferredContact: contact?.preferredContact ?? "email",
    },
    details: {
      Silhouette: silhouette.name.en,
      Cloth: fabric.name.en,
      Trim: submission.trimColor,
      "Print scale": submission.printScale,
      Notes: submission.notes,
    },
    estimate,
    photoFile,
    awaitingPayment: true,
    status: "new",
  };

  if (!(await recordRequest(record))) {
    return NextResponse.json({ error: "not-recorded" }, { status: 500 });
  }

  const checkout = await createCheckoutSession({
    reference,
    description: FEE_DESCRIPTION[submission.locale],
    estimate,
    customerEmail: account.email,
    locale: submission.locale,
    // A card finishes the page there and then, so the design reaches Daysi
    // the moment it is paid; closed after the same half hour a cart gets.
    expiresInMinutes: CHECKOUT_HOLD_MINUTES,
    cardsOnly: true,
  }).catch((error: unknown) => {
    console.error(`[stripe] Could not open a payment page for ${reference}.`, error);
    return null;
  });

  if (!checkout) {
    // No page to send the client to, and no webhook will ever come for it:
    // closed as a page that ran out would be, so no list shows it waiting.
    await markExpired(reference);
    return NextResponse.json({ error: "checkout-unavailable", reference }, { status: 502 });
  }

  return NextResponse.json({ reference, estimate, checkoutUrl: checkout.url });
}
