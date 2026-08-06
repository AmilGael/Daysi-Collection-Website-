import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ButtonLink } from "@/components/ui";

/**
 * Where Stripe sends the client back to. Both outcomes are a real page rather
 * than a redirect, so a client always lands somewhere that tells them what
 * happened and what their reference is.
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
  searchParams: Promise<{ reference?: string }>;
}) {
  const { locale, outcome } = await params;
  setRequestLocale(locale);
  if (!OUTCOMES.includes(outcome as Outcome)) notFound();

  const { reference } = await searchParams;
  const t = await getTranslations("checkout");
  const isPaid = outcome === "thank-you";

  return (
    <div className="shell flex min-h-[60svh] items-center py-24">
      <div className="flex max-w-xl flex-col gap-7">
        <h1 className="text-title">{isPaid ? t("thankYouTitle") : t("cancelledTitle")}</h1>
        <p className="text-lead text-ink-soft">
          {isPaid
            ? t("thankYouLead", { reference: reference ?? "—" })
            : t("cancelledLead", { reference: reference ?? "—" })}
        </p>
        <p className="text-[0.875rem] text-ink-faint">{t("secureNote")}</p>
        <ButtonLink href="/" className="w-fit">
          {t("backHome")}
        </ButtonLink>
      </div>
    </div>
  );
}
