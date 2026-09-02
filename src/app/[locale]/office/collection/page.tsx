import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { categories, translate } from "@/content";
import { manageableStyles, styleOverrides } from "@/lib/live-catalog";
import { liveFabrics, livePriceList } from "@/lib/live-pricing";
import { undoableIds } from "@/lib/office-history";
import { CollectionManager, type ManagedStyle } from "@/components/collection-manager";
import { StyleComposer } from "@/components/style-composer";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "../_lib/viewer";
import { applyCollectionChanges } from "./actions";

/** Collection: the rack, and the form that puts a new garment on it. */
export default async function OfficeCollectionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");

  const undoable = undoableIds("style-override");
  const overridesById = new Map(styleOverrides().map((override) => [override.styleId, override]));
  const managedStyles: ManagedStyle[] = manageableStyles().map((style) => ({
    id: style.id,
    name: translate(style.name, language),
    category: translate(
      categories.find((category) => category.id === style.categoryId)?.name ?? {
        en: style.categoryId,
        es: style.categoryId,
      },
      language,
    ),
    photo: (style.photos.find((photo) => photo.isPrimary) ?? style.photos[0])?.src ?? "",
    photoCount: style.photos.length,
    isPublished: style.isPublished,
    sizes: style.sizes.map((size) => ({
      sizeId: size.sizeId as "s" | "m" | "l",
      inStock: size.inStock,
    })),
    addedPhotos: overridesById.get(style.id)?.addedPhotos ?? [],
    coverSrc: overridesById.get(style.id)?.coverSrc,
    retired: style.retired,
    undoable: undoable.has(style.id),
  }));
  const active = managedStyles.filter((style) => !style.retired);
  const retired = managedStyles.filter((style) => style.retired);

  const composerCategories = categories.map((category) => ({
    id: category.id,
    label: translate(category.name, language),
  }));
  const composerFabrics = liveFabrics().map((fabric) => ({
    id: fabric.id,
    label: translate(fabric.name, language),
  }));
  const pricedPairs = Object.fromEntries(
    livePriceList().map((entry) => [entry.id, entry.fixedPrice]),
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("collection")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("collectionLead")}
        </p>
      </div>
      <OfficeDraftProvider apply={applyCollectionChanges}>
        <CollectionManager styles={active} retired={retired} locale={language} />

        <div className="flex flex-col gap-4 border-t border-line pt-8">
          <div className="flex flex-col gap-2">
            <h3 className="text-[0.9375rem] font-medium">{t("styleAddTitle")}</h3>
            <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
              {t("styleAddLead")}
            </p>
          </div>
          <StyleComposer
            categories={composerCategories}
            fabrics={composerFabrics}
            pricedPairs={pricedPairs}
            locale={language}
          />
        </div>
      </OfficeDraftProvider>
    </section>
  );
}
