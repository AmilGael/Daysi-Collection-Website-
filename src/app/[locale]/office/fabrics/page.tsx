import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { categories, translate } from "@/content";
import { customFabrics, liveFabrics } from "@/lib/live-pricing";
import { FabricManager } from "@/components/fabric-manager";
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

  const customIds = new Set(customFabrics().map((fabric) => fabric.id));
  const fabricWall = liveFabrics().map((fabric) => ({
    id: fabric.id,
    name: translate(fabric.name, language),
    swatchImage: fabric.swatchImage,
    custom: customIds.has(fabric.id),
  }));
  const fabricCategories = (["dresses", "pants", "shirts", "heritage"] as const).map((id) => ({
    id,
    label: translate(
      categories.find((category) => category.id === id)?.name ?? { en: id, es: id },
      language,
    ),
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
        <FabricManager fabrics={fabricWall} categories={fabricCategories} />
      </OfficeDraftProvider>
    </section>
  );
}
