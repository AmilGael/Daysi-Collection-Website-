import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ButtonLink } from "@/components/ui";
import { checkoutPaymentStatus } from "@/lib/payments";

/**
 * Where Stripe sends the client back to. Both outcomes are a real page rather
 * than a redirect, so a client always lands somewhere that tells them what
 * happened and what their reference is.
 *
 * The thank-you page asks Stripe whether the money is actually in: a bank
 * payment completes the page days before the funds move, and the plain thanks
 * would promise a receipt and a notified Daysi that have not happened yet. A
 * link without the session's id (made before this was added) or a failed
 * lookup shows the plain thanks.
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
  searchParams: Promise<{ reference?: string; session_id?: string | string[] }>;
}) {
  const { locale, outcome } = await params;
  setRequestLocale(locale);
  if (!OUTCOMES.includes(outcome as Outcome)) notFound();

  const { reference, session_id: sessionId } = await searchParams;
  const t = await getTranslations("checkout");
  const isPaid = outcome === "thank-you";

  // Only the thank-you page has anything to ask; a cancelled page never calls Stripe.
  const status =
    isPaid && reference && typeof sessionId === "string"
      ? await checkoutPaymentStatus(sessionId, reference)
      : "unknown";
  const pending = status === "pending";

  const title = isPaid ? (pending ? t("pendingTitle") : t("thankYouTitle")) : t("cancelledTitle");
  const lead = isPaid
    ? t(pending ? "pendingLead" : "thankYouLead", { reference: reference ?? "–" })
    : t("cancelledLead", { reference: reference ?? "–" });

  return (
    <div className="shell flex min-h-[60svh] items-center py-24">
      <div className="flex max-w-xl flex-col gap-7">
        <h1 className="text-title">{title}</h1>
        <p className="text-lead text-ink-soft">{lead}</p>
        <p className="text-[0.875rem] text-ink-faint">{t("secureNote")}</p>
        <ButtonLink href="/" className="w-fit">
          {t("backHome")}
        </ButtonLink>
      </div>
    </div>
  );
}
