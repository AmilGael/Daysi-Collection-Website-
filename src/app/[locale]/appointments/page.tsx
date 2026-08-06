import { getTranslations, setRequestLocale } from "next-intl/server";
import { appointmentTypes, consultationCreditDays } from "@/content";
import { paymentsEnabled } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { AppointmentBooking } from "@/components/appointment-booking";

export default async function AppointmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("appointments");

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <AppointmentBooking
          appointmentTypes={appointmentTypes}
          paymentsEnabled={paymentsEnabled}
          creditDays={consultationCreditDays}
        />
      </div>
    </>
  );
}
