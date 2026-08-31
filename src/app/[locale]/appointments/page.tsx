import { getTranslations, setRequestLocale } from "next-intl/server";
import { consultationCreditDays, services } from "@/content";
import { liveAlterations, liveAppointmentTypes } from "@/lib/live-pricing";
import { paymentsEnabled } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { AppointmentBooking } from "@/components/appointment-booking";
import { SiteNoticeBar } from "@/components/site-notice";

export default async function AppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("appointments");

  // Arriving from a service page, that service is already the reason for the
  // visit; an unknown value is simply nobody's service and books as a plain
  // session.
  const { service } = await searchParams;
  const chosenService = services.find((candidate) => candidate.id === service) ?? null;

  return (
    <>
      <SiteNoticeBar />
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <AppointmentBooking
          appointmentTypes={liveAppointmentTypes()}
          paymentsEnabled={paymentsEnabled}
          creditDays={consultationCreditDays}
          service={chosenService}
          alterations={liveAlterations()}
        />
      </div>
    </>
  );
}
