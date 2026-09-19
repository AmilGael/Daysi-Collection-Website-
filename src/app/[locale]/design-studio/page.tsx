import { getTranslations, setRequestLocale } from "next-intl/server";
import { liveFabrics, livePriceList } from "@/lib/live-pricing";
import { estimateDesign } from "@/lib/pricing";
import { paymentsEnabled } from "@/lib/env";
import { silhouettes } from "@/content/silhouettes";
import { currentViewer } from "@/lib/auth/session";
import { knownContact } from "@/lib/client-cards";
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
  const viewer = await currentViewer();
  const contact = viewer ? knownContact(viewer.account) : null;

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <DesignStudio
          silhouettes={silhouettes}
          fabrics={liveFabrics()}
          priceList={livePriceList()}
          fee={estimateDesign().dueNow}
          paymentsEnabled={paymentsEnabled}
          contact={contact}
        />
      </div>
    </>
  );
}
