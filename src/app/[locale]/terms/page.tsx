import { getTranslations, setRequestLocale } from "next-intl/server";
import { whatsappLink } from "@/lib/whatsapp";
import { PageHeader } from "@/components/page-header";

/**
 * The terms a client accepts before booking a session or sending a request.
 * They are written in plain language on purpose: a term nobody can read is a
 * term nobody agreed to.
 */
const SECTIONS = [
  "sessions",
  "cancellation",
  "prices",
  "deposits",
  "turnaround",
  "fittings",
  "garments",
  "designs",
  "privacy",
  "law",
] as const;

const LAST_UPDATED = "2026-08-06";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terms");

  const updated = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(LAST_UPDATED));

  return (
    <>
      <PageHeader eyebrow={t("updated", { date: updated })} title={t("title")} lead={t("intro")} />

      <div className="shell pb-24">
        <div className="flex max-w-2xl flex-col">
          {SECTIONS.map((section) => (
            <section key={section} className="border-t border-line py-8">
              <h2 className="text-heading">{t(`sections.${section}.title`)}</h2>
              <p className="mt-3 leading-[1.8] text-ink-soft">{t(`sections.${section}.body`)}</p>
            </section>
          ))}

          <p className="border-t border-line pt-8 text-[0.9375rem] leading-relaxed text-ink-faint">
            {t("questions")}{" "}
            <a
              href={whatsappLink(locale === "es" ? "Hola Daysi, una pregunta sobre los términos:" : "Hi Daysi, a question about the terms:")}
              target="_blank"
              rel="noreferrer noopener"
              className="link-underline text-ink"
            >
              WhatsApp
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
