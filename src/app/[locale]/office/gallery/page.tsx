import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { translate } from "@/content";
import { galleryWorks } from "@/content/gallery";
import { addedGalleryWorks, assembleGallery, GALLERY_ORDER, manageableGallery } from "@/lib/live-gallery";
import { undoableIds } from "@/lib/office-history";
import { GalleryManager, type ManagedWork } from "@/components/gallery-manager";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "../_lib/viewer";
import { applyGalleryChanges } from "./actions";

/** Gallery: the portfolio photographs, and a place to add one. */
export default async function OfficeGalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");
  const tg = await getTranslations("gallery");

  const undoable = undoableIds("work-visibility");
  const undoableTexts = undoableIds("work-text");
  const codedWorks = new Map(
    // No visibility argument: assembleGallery drops hidden works, and a hidden
    // photo with no coded entry would fall back to its merged caption, which is
    // exactly the equality that stops a clear from staging. manageableGallery
    // passes [] here for the same reason.
    assembleGallery(galleryWorks, addedGalleryWorks(), [], new Set()).map((work) => [work.id, work]),
  );
  const galleryWorksManaged: ManagedWork[] = manageableGallery().map((work) => ({
    id: work.id,
    src: work.src,
    width: work.width,
    height: work.height,
    category: work.category,
    caption: translate(work.caption, language),
    texts: { caption: work.caption },
    codedTexts: { caption: codedWorks.get(work.id)?.caption ?? work.caption },
    hidden: work.hidden,
    retired: work.retired,
    undoable: undoable.has(work.id),
  }));
  const active = galleryWorksManaged.filter((work) => !work.retired);
  const retired = galleryWorksManaged.filter((work) => work.retired);
  const galleryCategories = GALLERY_ORDER.map((id) => ({ id, label: tg(`category.${id}`) }));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("galleryTitle")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("galleryLead")}
        </p>
      </div>
      <OfficeDraftProvider apply={applyGalleryChanges}>
        <GalleryManager
          works={active}
          retired={retired}
          categories={galleryCategories}
          undoableTexts={undoableTexts}
        />
      </OfficeDraftProvider>
    </section>
  );
}
