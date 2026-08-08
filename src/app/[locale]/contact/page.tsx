import { getTranslations, setRequestLocale } from "next-intl/server";
import { business, translate } from "@/content";
import type { Locale } from "@/i18n/routing";
import { whatsappLink } from "@/lib/whatsapp";
import { PageHeader } from "@/components/page-header";
import { ContactForm } from "@/components/contact-form";
import { GoogleBusiness } from "@/components/google-business";
import { SiteQrCode } from "@/components/site-qr-code";
import { ExternalButtonLink } from "@/components/ui";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("contact");

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />

      <section className="shell grid gap-14 pb-24 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <ExternalButtonLink
              href={whatsappLink(language === "es" ? "Hola Daysi," : "Hi Daysi,")}
              tone="marigold"
              className="w-fit"
            >
              {business.phone} · WhatsApp
            </ExternalButtonLink>
            <a href={`mailto:${business.email}`} className="link-underline w-fit">
              {business.email}
            </a>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
              {t("hours")}
            </h2>
            <dl className="flex flex-col">
              {business.hours.map((day) => (
                <div
                  key={day.day.en}
                  className="flex items-baseline justify-between gap-6 border-b border-line py-2.5 text-[0.9375rem]"
                >
                  <dt className="text-ink-soft">{translate(day.day, language)}</dt>
                  <dd className="tabular-nums text-ink-faint">
                    {day.closes ? `${day.opens} – ${day.closes}` : t("closed")}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-[0.8125rem] text-ink-faint">{t("byAppointment")}</p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
              {t("serviceArea")}
            </h2>
            <p className="text-[0.9375rem] text-ink-soft">
              {translate(business.serviceArea, language)}
            </p>
            <p className="max-w-sm text-[0.875rem] leading-relaxed text-ink-faint">
              {translate(business.addressNote, language)}
            </p>
          </div>

          <div className="flex flex-col gap-4 border-t border-line pt-8">
            <h2 className="text-heading">{t("qrTitle")}</h2>
            <p className="max-w-sm text-[0.875rem] leading-relaxed text-ink-faint">
              {t("qrLead")}
            </p>
            <SiteQrCode size={168} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <h2 className="text-heading">{t("formTitle")}</h2>
          <ContactForm />
        </div>
      </section>

      <GoogleBusiness />
    </>
  );
}
