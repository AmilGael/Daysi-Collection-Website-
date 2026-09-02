import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { translate } from "@/content";
import { GALLERY_ORDER, manageableGallery } from "@/lib/live-gallery";
import { GalleryManager, type ManagedWork } from "@/components/gallery-manager";
import { officeViewer } from "../_lib/viewer";

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

  const galleryWorksManaged: ManagedWork[] = manageableGallery().map((work) => ({
    id: work.id,
    src: work.src,
    width: work.width,
    height: work.height,
    category: work.category,
    caption: translate(work.caption, language),
    hidden: work.hidden,
  }));
  const galleryCategories = GALLERY_ORDER.map((id) => ({ id, label: tg(`category.${id}`) }));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("galleryTitle")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("galleryLead")}
        </p>
      </div>
      <GalleryManager works={galleryWorksManaged} categories={galleryCategories} />
    </section>
  );
}
