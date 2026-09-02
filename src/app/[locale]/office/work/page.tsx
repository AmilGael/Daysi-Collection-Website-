import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { loadLedger } from "@/lib/earnings";
import { activeRequests, manageableRequests, REQUEST_KINDS } from "@/lib/request-store";
import { OfficeRequestList } from "@/components/office-request-list";
import { PremiereSignupList, WorkRetiredGroup } from "@/components/office/premiere-signup-list";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "../_lib/viewer";
import { applyWorkChanges } from "./actions";

/** Work: orders and alterations, sessions, messages, and the premiere list. */
export default async function OfficeWorkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");

  const ledger = loadLedger();
  const messages = activeRequests("contact");
  const signups = activeRequests("premiere-signup");
  const appointments = ledger.filter((record) => record.kind === "appointment");
  const work = ledger.filter((record) => record.kind !== "appointment");
  const retired = REQUEST_KINDS.flatMap(manageableRequests).filter((record) => record.retired);

  return (
    <OfficeDraftProvider apply={applyWorkChanges}>
      <section className="flex flex-col gap-6">
        <h2 className="text-heading">{t("work")}</h2>
        <OfficeRequestList records={work} locale={language} emptyMessage={t("noWork")} />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-heading">{t("sessions")}</h2>
        <OfficeRequestList
          records={appointments}
          locale={language}
          emptyMessage={t("noSessions")}
        />
      </section>

      <section className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <h2 className="text-heading">{t("messages")}</h2>
          <OfficeRequestList
            records={messages}
            locale={language}
            emptyMessage={t("noMessages")}
          />
        </div>
        <div className="flex flex-col gap-6">
          <h2 className="text-heading">{t("premiereList")}</h2>
          <PremiereSignupList records={signups} emptyMessage={t("noSignups")} />
        </div>
      </section>

      <WorkRetiredGroup records={retired} />
    </OfficeDraftProvider>
  );
}
