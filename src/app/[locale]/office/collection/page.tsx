import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { categories, styles, translate } from "@/content";
import { translationEnabled } from "@/lib/env";
import { addedStyles, assembleStyles, manageableStyles } from "@/lib/live-catalog";
import { liveFabrics, livePriceList, resolveStylePrice } from "@/lib/live-pricing";
import { undoableIds } from "@/lib/office-history";
import { CollectionCards } from "@/components/collection-cards";
import type { ManagedStyle } from "@/components/office/garment-draft";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "../_lib/viewer";
import { applyCollectionChanges } from "./actions";

/** Colección: the rack as cards, and the sheet that opens one. */
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
  const undoableTexts = undoableIds("style-text");
  const codedStyles = new Map(
    assembleStyles(styles, addedStyles(), [], new Set()).map((style) => [style.id, style]),
  );
  const entries = livePriceList();
  const listed = new Map(entries.map((entry) => [entry.id, entry]));
  const managedStyles: ManagedStyle[] = manageableStyles().map((style) => ({
    id: style.id,
    slug: style.slug,
    name: translate(style.name, language),
    category: translate(
      categories.find((category) => category.id === style.categoryId)?.name ?? {
        en: style.categoryId,
        es: style.categoryId,
      },
      language,
    ),
    price: resolveStylePrice(style, entries)?.fixedPrice ?? null,
    listPrice: listed.get(style.priceEntryId)?.fixedPrice ?? null,
    listExtra: listed.get(style.priceEntryId)?.customizationExtra ?? null,
    ownPrice: style.ownPrice
      ? { fixedPrice: style.ownPrice.fixedPrice, customizationExtra: style.ownPrice.customizationExtra ?? null }
      : null,
    photos: style.photos.map((photo) => photo.src),
    isPublished: style.isPublished,
    inStudio: style.inStudio === true,
    sizes: style.sizes.map((size) => ({
      sizeId: size.sizeId as "s" | "m" | "l",
      inStock: size.inStock,
      ...(size.count === undefined ? {} : { count: size.count }),
    })),
    retired: style.retired,
    undoable: undoable.has(style.id),
    texts: {
      name: style.name,
      color: style.color,
      description: style.description,
      detail: style.detail,
    },
    codedTexts: {
      name: codedStyles.get(style.id)?.name ?? style.name,
      color: codedStyles.get(style.id)?.color ?? style.color,
      description: codedStyles.get(style.id)?.description ?? style.description,
      detail: codedStyles.get(style.id)?.detail ?? style.detail,
    },
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
    entries.map((entry) => [entry.id, { fixedPrice: entry.fixedPrice, customizationExtra: entry.customizationExtra }]),
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
        <CollectionCards
          styles={active}
          retired={retired}
          locale={language}
          categories={composerCategories}
          fabrics={composerFabrics}
          pricedPairs={pricedPairs}
          undoableTexts={undoableTexts}
          translationEnabled={translationEnabled}
        />
      </OfficeDraftProvider>
    </section>
  );
}
