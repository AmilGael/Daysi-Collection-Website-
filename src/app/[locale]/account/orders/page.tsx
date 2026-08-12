import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { currentViewer } from "@/lib/auth/session";
import { requestsForAccount } from "@/lib/request-store";
import { PageHeader } from "@/components/page-header";
import { RequestList } from "@/components/request-list";

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;

  const viewer = await currentViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);

  const t = await getTranslations("account");
  const records = requestsForAccount(viewer.account, [
    "order",
    "alteration",
    "commission",
    "appointment",
  ]);

  return (
    <>
      <PageHeader title={t("orders")} lead={t("ordersLead")} />
      <div className="shell pb-28">
        <RequestList records={records} locale={language} emptyMessage={t("nothingYet")} />
      </div>
    </>
  );
}
