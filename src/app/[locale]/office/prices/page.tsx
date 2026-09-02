import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { categories, translate } from "@/content";
import {
  liveAlterations,
  liveAppointmentTypes,
  liveFabrics,
  manageablePriceList,
} from "@/lib/live-pricing";
import { PriceManager } from "@/components/price-manager";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "../_lib/viewer";
import { applyPriceChanges } from "./actions";

/** Prices: garments, alterations and sessions, each a number she can change. */
export default async function OfficePricesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");

  const priceEntries = manageablePriceList().map((entry) => ({
    id: entry.id,
    garment: translate(
      categories.find((category) => category.id === entry.categoryId)?.name ?? {
        en: entry.categoryId,
        es: entry.categoryId,
      },
      language,
    ),
    fabric: translate(
      liveFabrics().find((fabric) => fabric.id === entry.fabricId)?.name ?? {
        en: entry.fabricId,
        es: entry.fabricId,
      },
      language,
    ),
    fixedPrice: entry.fixedPrice,
    customizationExtra: entry.customizationExtra,
    retired: entry.retired,
  }));
  const priceAlterations = liveAlterations().map((alteration) => ({
    id: alteration.id,
    name: translate(alteration.name, language),
    fixedPrice: alteration.fixedPrice,
    rushSurcharge: alteration.rushSurcharge,
  }));
  const priceAppointments = liveAppointmentTypes().map((type) => ({
    id: type.id,
    name: translate(type.name, language),
    fee: type.fee,
  }));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("pricesTitle")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("pricesLead")}
        </p>
      </div>
      <OfficeDraftProvider apply={applyPriceChanges}>
        <PriceManager
          entries={priceEntries.filter((entry) => !entry.retired)}
          retiredEntries={priceEntries.filter((entry) => entry.retired)}
          alterations={priceAlterations}
          appointments={priceAppointments}
        />
      </OfficeDraftProvider>
    </section>
  );
}
