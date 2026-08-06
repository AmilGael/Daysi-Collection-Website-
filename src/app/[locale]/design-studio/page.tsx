import { getTranslations, setRequestLocale } from "next-intl/server";
import { fabrics, priceList } from "@/content";
import { silhouettes } from "@/content/silhouettes";
import { PageHeader } from "@/components/page-header";
import { DesignStudio } from "@/components/design-studio";

export default async function DesignStudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("studio");
  const tn = await getTranslations("nav");

  return (
    <>
      <PageHeader eyebrow={tn("studio")} title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <DesignStudio silhouettes={silhouettes} fabrics={fabrics} priceList={priceList} />
      </div>
    </>
  );
}
