import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  alterationServices,
  appointmentTypes,
  categories,
  fabrics,
  findCategory,
  findFabric,
  priceList,
  publishedStyles,
  translate,
} from "@/content";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import { paymentsEnabled } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { EstimateBuilder } from "@/components/estimate-builder";
import { Prose, SectionHeading } from "@/components/ui";

export default async function PricesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("prices");
  const tn = await getTranslations("nav");

  return (
    <>
      <PageHeader eyebrow={tn("prices")} title={t("title")} lead={t("lead")} />

      <section className="shell pb-20">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-ink">
              <Th>{t("tableGarment")}</Th>
              <Th>{t("tableFabric")}</Th>
              <Th align="right">{t("tablePrice")}</Th>
              <Th align="right">{t("tableCustom")}</Th>
            </tr>
          </thead>
          <tbody>
            {priceList.map((entry) => {
              const category = findCategory(entry.categoryId);
              const fabric = findFabric(entry.fabricId);
              return (
                <tr key={entry.id} className="border-b border-line">
                  <td className="py-4 pr-6 text-[0.9375rem]">
                    {category ? translate(category.name, language) : entry.categoryId}
                  </td>
                  <td className="py-4 pr-6 text-[0.9375rem] text-ink-soft">
                    {fabric ? translate(fabric.name, language) : entry.fabricId}
                  </td>
                  <td className="py-4 text-right tabular-nums">
                    {formatMoney(entry.fixedPrice, language)}
                  </td>
                  <td className="py-4 text-right tabular-nums text-ink-faint">
                    + {formatMoney(entry.customizationExtra, language)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="reveal bg-paper-warm py-20">
        <div className="shell flex flex-col gap-6">
          <SectionHeading eyebrow={tn("prices")} title={t("why")} />
          <Prose>
            <p>{t("whyBody")}</p>
          </Prose>
        </div>
      </section>

      <section className="shell reveal flex flex-col gap-12 py-24">
        <SectionHeading
          eyebrow={t("estimateTitle")}
          title={t("estimateTitle")}
          lead={t("estimateLead")}
        />
        <EstimateBuilder
          styles={publishedStyles()}
          categories={categories}
          fabrics={fabrics}
          alterations={alterationServices}
          appointmentTypes={appointmentTypes}
          priceList={priceList}
          paymentsEnabled={paymentsEnabled}
        />
      </section>
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`py-4 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}
