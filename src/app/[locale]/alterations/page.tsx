import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { liveAlterations } from "@/lib/live-pricing";
import type { Locale } from "@/i18n/routing";
import { AlterationCards } from "@/components/alteration-cards";
import { PageHeader } from "@/components/page-header";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { PHOTO_QUALITY } from "@/lib/images";

/**
 * A clothing page, not a price sheet: the alterations as cards with a drawing
 * each, the one note that a price can grow once the garment is on the table,
 * how a request goes in three steps, and the guarantee. The list is the live
 * one, so an alteration Daysi adds from the office is a card here too.
 */
export default async function AlterationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("alterations");
  const steps = [t("stepTell"), t("stepPrice"), t("stepCollect")];

  return (
    <>
      <PageHeader title={t("title")} lead={t("variesNote")} />

      <section className="shell pb-16">
        <AlterationCards alterations={liveAlterations()} locale={language} />
      </section>

      <section className="shell flex flex-col gap-8 pb-20">
        <ol aria-label={t("stepsLabel")} className="grid grid-cols-3 gap-3 border-t border-line pt-8 sm:gap-6">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-2 sm:gap-3">
              <span aria-hidden className="font-display text-[1.5rem] leading-none tabular-nums text-ink-faint sm:text-[2rem]">
                {index + 1}
              </span>
              <span className="text-[0.8125rem] leading-snug sm:text-[0.9375rem]">{step}</span>
              {index < steps.length - 1 ? (
                <span aria-hidden className="ml-auto hidden text-ink-faint sm:inline">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="max-w-2xl border-l-2 border-marigold pl-4 text-[0.9375rem] leading-relaxed text-ink-soft">
          {t("guarantee")}
        </p>
      </section>

      <section className="reveal bg-paper-warm">
        <div className="shell grid gap-12 py-24 lg:grid-cols-2 lg:items-center lg:gap-20">
          <div className="relative aspect-4/3 overflow-hidden">
            <Image
              src="/images/real/craft-detail.jpg"
              alt=""
              fill
              quality={PHOTO_QUALITY}
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col gap-8">
            <SectionHeading
              title={t("requestTitle")}
              lead={t("requestLead")}
            />
            <ButtonLink href="/request?kind=alteration" className="w-fit">
              {t("requestTitle")}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
