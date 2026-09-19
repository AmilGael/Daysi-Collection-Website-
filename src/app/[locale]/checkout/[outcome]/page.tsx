import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ButtonLink, TextLink } from "@/components/ui";
import { currentViewer } from "@/lib/auth/session";
import { cancelledState, thankYouState } from "@/lib/checkout-outcome";
import { cardForAccount, measuredCount } from "@/lib/client-cards";
import { callerKey } from "@/lib/rate-limit";
import { findRequest } from "@/lib/request-store";

/**
 * Where Stripe sends the client back to. Both outcomes are a real page rather
 * than a redirect, so a client always lands somewhere that tells them what
 * happened and what their reference is.
 *
 * The thank-you page says only what the store can back: paid, a bank
 * payment on its way, a bank payment refused, or a plain thanks that promises
 * nothing when the webhook has not landed yet and Stripe could not be asked.
 * See `thankYouState`.
 *
 * The cancelled page closes the payment page the client backed out of, and
 * the order with it, so nothing waits on a payment they said no to. Its copy
 * is the same whatever the close found: nothing was charged either way. See
 * `cancelledState`.
 */
const OUTCOMES = ["thank-you", "cancelled"] as const;
type Outcome = (typeof OUTCOMES)[number];

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    OUTCOMES.map((outcome) => ({ locale, outcome })),
  );
}

export default async function CheckoutOutcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; outcome: string }>;
  searchParams: Promise<{ reference?: string | string[]; session_id?: string | string[] }>;
}) {
  const { locale, outcome } = await params;
  setRequestLocale(locale);
  if (!OUTCOMES.includes(outcome as Outcome)) notFound();

  const query = await searchParams;
  // A repeated query key arrives as an array; neither is a reference.
  const reference = typeof query.reference === "string" ? query.reference : undefined;
  const t = await getTranslations("checkout");

  if (outcome === "cancelled" && reference) {
    await cancelledState({
      reference,
      sessionId: query.session_id,
      caller: callerKey({ headers: await headers() }, "cancel"),
    });
  }

  const state =
    outcome === "thank-you" && reference
      ? await thankYouState({
          reference,
          sessionId: query.session_id,
          caller: callerKey({ headers: await headers() }, "thank-you"),
        })
      : "unknown";

  const copy =
    outcome === "cancelled"
      ? "cancelled"
      : state === "paid"
        ? "thankYou"
        : state === "pending"
          ? "pending"
          : state === "failed"
            ? "failed"
            : "unknown";
  const note = state === "pending" ? t("bankNote") : state === "failed" ? null : t("secureNote");

  // A booking deposit and a studio design's fee reach this same cancelled
  // page as an order's checkout, but "order {reference}" is wrong for a
  // client who never bought a garment. The lead and the way back both follow
  // the record's own kind; an unknown reference falls back to the order copy
  // and home.
  const cancelledKind =
    copy === "cancelled" && reference !== undefined ? findRequest(reference)?.kind : undefined;
  const cancelledBooking = cancelledKind === "appointment";
  const cancelledDesign = cancelledKind === "design";
  const leadKey = cancelledBooking
    ? "cancelledBookingLead"
    : cancelledDesign
      ? "cancelledDesignLead"
      : `${copy}Lead`;
  const backHref = cancelledBooking ? "/appointments" : cancelledDesign ? "/design-studio" : "/";

  // The nudge to save measurements: only once payment is confirmed, and only
  // for a client whose card does not have one yet — a guest who never signed
  // in counts as unmeasured too, since there is no card to check.
  let ask = false;
  if (state === "paid") {
    const viewer = await currentViewer();
    ask = !viewer || measuredCount(cardForAccount(viewer.account)) === 0;
  }

  return (
    <div className="shell flex min-h-[60svh] items-center py-24">
      <div className="flex max-w-xl flex-col gap-7">
        <h1 className="text-title">{t(`${copy}Title`)}</h1>
        <p className="text-lead text-ink-soft">{t(leadKey, { reference: reference ?? "-" })}</p>
        {note ? <p className="text-[0.875rem] text-ink-faint">{note}</p> : null}
        {ask ? <TextLink href="/account/details">{t("saveMeasures")}</TextLink> : null}
        <ButtonLink href={backHref} className="w-fit">
          {t("backHome")}
        </ButtonLink>
      </div>
    </div>
  );
}
