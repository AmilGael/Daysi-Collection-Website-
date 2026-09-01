import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { categories, primaryPhoto, translate } from "@/content";
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
import { PHOTO_QUALITY } from "@/lib/images";

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
  const styles = liveStyles();

  const groups = categories
    .map((category) => ({
      category,
      // The garment pictured beside the heading: the first published piece in
      // this category, which is also the one the collection leads with.
      photo: styles
        .filter((style) => style.categoryId === category.id)
        .map((style) => primaryPhoto(style))
        .find((photo) => photo !== undefined),
      rows: entries
        .filter((entry) => entry.categoryId === category.id)
        .map((entry) => {
          const fabric = fabrics.find((candidate) => candidate.id === entry.fabricId);
          return {
            id: entry.id,
            fabric: fabric?.name ?? { en: entry.fabricId, es: entry.fabricId },
            swatch: fabric?.swatchImage ?? null,
            price: entry.fixedPrice,
            extra: entry.customizationExtra,
          };
        })
        .sort((a, b) => a.price - b.price),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />

      <section className="shell grid gap-x-16 gap-y-14 pb-8 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.category.id} className="flex flex-col gap-4">
            {/* The garment beside its heading, and each cloth beside its
                price: the list a client reads is the thing she is reading
                about, not a table of nouns. */}
            <div className="flex items-start gap-5">
              {group.photo ? (
                <div className="relative aspect-3/4 w-20 shrink-0 overflow-hidden bg-paper-warm">
                  <Image
                    src={group.photo.src}
                    alt={translate(group.photo.alt, language)}
                    fill
                    quality={PHOTO_QUALITY}
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-[1.5rem] leading-tight">
                  {translate(group.category.name, language)}
                </h2>
                <p className="text-[0.8125rem] leading-relaxed text-ink-faint">
                  {translate(group.category.blurb, language)}
                </p>
              </div>
            </div>

            <dl className="flex flex-col border-t border-ink">
              {group.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-6 border-b border-line py-2.5"
                >
                  <dt className="flex items-center gap-3 text-[0.9375rem] text-ink-soft">
                    {row.swatch ? (
                      <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-[2px]">
                        {/* Decorative: the row already names the cloth. */}
                        <Image src={row.swatch} alt="" fill sizes="36px" className="object-cover" />
                      </span>
                    ) : null}
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
