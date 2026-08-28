import { getTranslations, setRequestLocale } from "next-intl/server";
import { categories, translate } from "@/content";
import {
  liveAlterations,
  liveAppointmentTypes,
  liveFabrics,
  livePriceList,
} from "@/lib/live-pricing";
import { liveStyles } from "@/lib/live-catalog";
import { Link, type Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import { paymentsEnabled } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { EstimateBuilder } from "@/components/estimate-builder";
import { Prose, SectionHeading, TextLink } from "@/components/ui";

/**
 * The price list, read the way a client reads it: by the garment they want.
 *
 * This used to be one flat table of every garment-and-cloth pair, which put a
 * made-to-measure column beside every row repeating the same figure — the
 * charge is set per category, so twelve rows carried four distinct numbers
 * between them. Grouping by garment lets that charge be said once, drops a
 * whole column, and turns a wall of rows into four short lists you can scan.
 */
export default async function PricesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("prices");

  const entries = livePriceList();
  const fabrics = liveFabrics();

  const groups = categories
    .map((category) => ({
      category,
      rows: entries
        .filter((entry) => entry.categoryId === category.id)
        .map((entry) => ({
          id: entry.id,
          fabric:
            fabrics.find((fabric) => fabric.id === entry.fabricId)?.name ??
            { en: entry.fabricId, es: entry.fabricId },
          price: entry.fixedPrice,
          extra: entry.customizationExtra,
        }))
        .sort((a, b) => a.price - b.price),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />

      <section className="shell grid gap-x-16 gap-y-14 pb-8 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.category.id} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-[1.5rem] leading-tight">
                {translate(group.category.name, language)}
              </h2>
              <p className="text-[0.8125rem] leading-relaxed text-ink-faint">
                {translate(group.category.blurb, language)}
              </p>
            </div>

            <dl className="flex flex-col border-t border-ink">
              {group.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-baseline justify-between gap-6 border-b border-line py-3"
                >
                  <dt className="text-[0.9375rem] text-ink-soft">
                    {translate(row.fabric, language)}
                  </dt>
                  <dd className="shrink-0 text-[0.9375rem] tabular-nums">
                    {formatMoney(row.price, language)}
                  </dd>
                </div>
              ))}
              {/* Said once per garment rather than repeated on every row: the
                  made-to-measure charge is set per category, not per cloth. */}
              <div className="flex items-baseline justify-between gap-6 py-3">
                <dt className="text-[0.8125rem] text-ink-faint">{t("tableCustom")}</dt>
                <dd className="shrink-0 text-[0.8125rem] tabular-nums text-ink-faint">
                  + {formatMoney(group.rows[0]?.extra ?? 0, language)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </section>

      <section className="shell flex flex-wrap items-baseline gap-x-8 gap-y-2 pb-20">
        <TextLink href="/alterations">{t("alterationsLink")}</TextLink>
        <TextLink href="/appointments">{t("sessionsLink")}</TextLink>
        <p className="text-[0.8125rem] text-ink-faint">{t("taxNote")}</p>
      </section>

      <section className="reveal border-y border-line bg-paper-warm py-20">
        <div className="shell flex flex-col gap-6">
          <SectionHeading title={t("why")} />
          <Prose>
            <p>{t("whyBody")}</p>
          </Prose>
        </div>
      </section>

      <section className="shell reveal flex flex-col gap-10 py-24">
        <SectionHeading title={t("estimateTitle")} lead={t("estimateLead")} />
        <EstimateBuilder
          styles={liveStyles()}
          categories={categories}
          fabrics={fabrics}
          alterations={liveAlterations()}
          appointmentTypes={liveAppointmentTypes()}
          priceList={entries}
          paymentsEnabled={paymentsEnabled}
        />
      </section>
    </>
  );
}
