import { getTranslations, setRequestLocale } from "next-intl/server";
import { categories, sizes } from "@/content";
import { liveStyles } from "@/lib/live-catalog";
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

  return (
    <div className="pb-24">
      <PageHeader title={t("title")} lead={t("lead")} />
      <CollectionGallery styles={liveStyles()} categories={categories} sizes={sizes} />
    </div>
  );
}
