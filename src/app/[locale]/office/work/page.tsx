import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { loadLedger } from "@/lib/earnings";
import { activeRequests } from "@/lib/request-store";
import { OfficeRequestList } from "@/components/office-request-list";
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
          {signups.length === 0 ? (
            <p className="border border-dashed border-line px-6 py-14 text-center text-[0.9375rem] text-ink-faint">
              {t("noSignups")}
            </p>
          ) : (
            <ul className="flex flex-col border-t border-line">
              {signups.map((signup) => (
                <li
                  key={signup.reference}
                  className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[0.875rem]"
                >
                  <span className="break-all">{signup.client.email}</span>
                  <span className="shrink-0 text-[0.75rem] text-ink-faint">
                    {String(signup.details.Season ?? "")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </OfficeDraftProvider>
  );
}
