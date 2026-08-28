import Image from "next/image";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { alterationServices, translate } from "@/content";
import { liveAlterations } from "@/lib/live-pricing";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { PHOTO_QUALITY } from "@/lib/images";

export default async function AlterationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("alterations");

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />

      <section className="shell pb-20">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-ink">
              <th className="py-4 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
                {t("tableService")}
              </th>
              <th className="hidden py-4 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint sm:table-cell">
                {t("tableTurnaround")}
              </th>
              <th className="py-4 text-right text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
                {t("tablePrice")}
              </th>
            </tr>
          </thead>
          <tbody>
            {liveAlterations().map((alteration) => (
              <tr key={alteration.id} className="border-b border-line align-top">
                <td className="py-5 pr-6">
                  <p className="text-[1.0625rem]">{translate(alteration.name, language)}</p>
                  <p className="mt-1 max-w-md text-[0.875rem] leading-relaxed text-ink-faint">
                    {translate(alteration.description, language)}
                  </p>
                </td>
                <td className="hidden py-5 pr-6 text-[0.875rem] text-ink-faint sm:table-cell">
                  {translate(alteration.turnaround, language)}
                </td>
                <td className="py-5 text-right">
                  <p className="tabular-nums">{formatMoney(alteration.fixedPrice, language)}</p>
                  <p className="mt-1 text-[0.75rem] text-ink-faint">
                    + {formatMoney(alteration.rushSurcharge, language)} {t("rushTitle")}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-8 max-w-2xl border-l-2 border-marigold pl-4 text-[0.9375rem] leading-relaxed text-ink-soft">
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
