import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { translate } from "@/content";
import type { GalleryCategoryId } from "@/content/types";
import { GALLERY_ORDER, liveGallery } from "@/lib/live-gallery";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { GalleryWall, type WallWork } from "@/components/gallery-wall";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gallery" });
  return { title: `${t("title")} · Daysi Collection`, description: t("lead") };
}

/**
 * The portfolio. Everything Daysi has made that a client might want to see
 * before trusting her with something of their own — and nothing that is for
 * sale, which is what keeps it separate from the collection.
 */
export default async function GalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("gallery");

  const works: WallWork[] = liveGallery().map((work) => ({
    id: work.id,
    src: work.src,
    width: work.width,
    height: work.height,
    category: work.category,
    caption: translate(work.caption, language),
  }));

  const present = new Set(works.map((work) => work.category));
  const categories = GALLERY_ORDER.filter((id) => present.has(id)).map((id) => ({
    id: id as GalleryCategoryId,
    label: t(`category.${id}`),
  }));

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="pb-24">
        <GalleryWall works={works} categories={categories} />
      </div>
    </>
  );
}
