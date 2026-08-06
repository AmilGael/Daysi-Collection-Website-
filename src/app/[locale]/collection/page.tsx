import { getTranslations, setRequestLocale } from "next-intl/server";
import { categories, publishedStyles, sizes } from "@/content";
import { PageHeader } from "@/components/page-header";
import { CollectionGallery } from "@/components/collection-gallery";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("collection");
  const tn = await getTranslations("nav");

  return (
    <>
      <PageHeader eyebrow={tn("collection")} title={t("title")} lead={t("lead")} />
      <div className="shell pb-24">
        <CollectionGallery
          styles={publishedStyles()}
          categories={categories}
          sizes={sizes}
        />
      </div>
    </>
  );
}
