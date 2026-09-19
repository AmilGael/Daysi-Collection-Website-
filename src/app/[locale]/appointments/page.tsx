import { getTranslations, setRequestLocale } from "next-intl/server";
import { consultationCreditDays, services } from "@/content";
import { liveAlterations, liveAppointmentTypes } from "@/lib/live-pricing";
import { appointmentPrefill } from "@/lib/estimate-handoff";
import { paymentsEnabled } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { AppointmentBooking } from "@/components/appointment-booking";

export default async function AppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string; type?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("appointments");

  // Arriving from a service page, that service is already the reason for the
  // visit; an unknown value is simply nobody's service and books as a plain
  // session.
  const query = await searchParams;
  const chosenService = services.find((candidate) => candidate.id === query.service) ?? null;

  // The session picked in the estimate builder, when it is one still offered.
  const appointmentTypes = liveAppointmentTypes();
  const chosenTypeId = appointmentPrefill(query, appointmentTypes.map((type) => type.id));

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <AppointmentBooking
          appointmentTypes={appointmentTypes}
          paymentsEnabled={paymentsEnabled}
          creditDays={consultationCreditDays}
          service={chosenService}
          initialTypeId={chosenTypeId}
          alterations={liveAlterations()}
        />
      </div>
    </>
  );
}
