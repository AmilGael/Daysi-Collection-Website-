import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { translate } from "@/content";
import { liveFabrics, livePriceList, manageableCustomFabrics } from "@/lib/live-pricing";
import { FabricManager } from "@/components/fabric-manager";
import { pricesFromEntries, type ManagedFabric } from "@/components/office/fabric-draft";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "../_lib/viewer";
import { applyFabricChanges } from "./actions";

/** Fabrics: the wall, and a place to hang a new roll. */
export default async function OfficeFabricsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");

  const custom = manageableCustomFabrics();
  const customIds = new Set(custom.map((fabric) => fabric.id));
  const entries = livePriceList();
  const fabricWall: ManagedFabric[] = liveFabrics().map((fabric) => ({
    id: fabric.id,
    name: translate(fabric.name, language),
    swatchImage: fabric.swatchImage,
    custom: customIds.has(fabric.id),
    prices: pricesFromEntries(fabric.id, entries),
  }));
  const retired: ManagedFabric[] = custom
    .filter((fabric) => fabric.retired)
    .map((fabric) => ({
      id: fabric.id,
      name: fabric.name,
      swatchImage: fabric.swatchImage,
      custom: true,
      prices: fabric.prices,
    }));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("fabricsTitle")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("fabricsLead")}
        </p>
      </div>
      <OfficeDraftProvider apply={applyFabricChanges}>
        <FabricManager fabrics={fabricWall} retired={retired} locale={language} />
      </OfficeDraftProvider>
    </section>
  );
}
