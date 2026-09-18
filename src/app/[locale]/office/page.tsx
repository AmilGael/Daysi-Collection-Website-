import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { earningsFrom, loadLedger, monthlyReceived } from "@/lib/earnings";
import { formatMoney } from "@/lib/money";
import {
  activeRequests,
  manageableRequests,
  REQUEST_KINDS,
  unfinishedCheckout,
} from "@/lib/request-store";
import { undoableIds } from "@/lib/office-history";
import { Figure } from "@/components/office/figure";
import { OfficeRequestList } from "@/components/office-request-list";
import { PremiereSignupList, WorkRetiredGroup } from "@/components/office/premiere-signup-list";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "./_lib/viewer";
import { applyWorkChanges } from "./work/actions";

/**
 * Hub: the money at a glance, then what needs her, then the months.
 *
 * One tab where there were two (Hoy and Trabajo, until 14 September 2026).
 * The figures and the work read the same ledger, so it is loaded once. The
 * six months of bars sit under the work: they are read when there is time,
 * not acted on. The whole page sits inside one draft provider so the bar
 * pins to the bottom of the tab, as on every other editable tab.
 */
export default async function OfficeHubPage({
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
  const earnings = earningsFrom(ledger);
  const months = monthlyReceived(ledger, 6, new Date());
  const peak = Math.max(...months.map((month) => month.total), 1);

  const appointments = ledger.filter((record) => record.kind === "appointment");
  const work = ledger.filter((record) => record.kind !== "appointment");
  const messages = activeRequests("contact");
  const signups = activeRequests("premiere-signup");
  // A card page nobody paid is not an order, retired or not.
  const retired = REQUEST_KINDS.flatMap(manageableRequests).filter(
    (r) => r.retired && !unfinishedCheckout(r),
  );
  const undoable = undoableIds("request-status");
  const withUndoable = (records: typeof work) =>
    records.map((record) => ({ ...record, undoable: undoable.has(record.reference) }));

  return (
    <OfficeDraftProvider apply={applyWorkChanges}>
      <section className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Figure label={t("received")} value={formatMoney(earnings.received, language)} emphasis />
        <Figure label={t("outstanding")} value={formatMoney(earnings.outstanding, language)} />
        <Figure label={t("openJobs")} value={String(earnings.openCount)} />
        <Figure label={t("upcomingSessions")} value={String(appointments.length)} />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-heading">{t("work")}</h2>
        <OfficeRequestList records={withUndoable(work)} locale={language} emptyMessage={t("noWork")} />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-heading">{t("sessions")}</h2>
        <OfficeRequestList
          records={withUndoable(appointments)}
          locale={language}
          emptyMessage={t("noSessions")}
        />
      </section>

      <section className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <h2 className="text-heading">{t("messages")}</h2>
          <OfficeRequestList
            records={withUndoable(messages)}
            locale={language}
            emptyMessage={t("noMessages")}
          />
        </div>
        <div className="flex flex-col gap-6">
          <h2 className="text-heading">{t("premiereList")}</h2>
          <PremiereSignupList records={signups} emptyMessage={t("noSignups")} />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-heading">{t("lastMonths")}</h2>
        {/* A plain bar row: six months is a shape you read, not a chart you study. */}
        <div className="flex items-end gap-3 border-b border-line pb-3" style={{ height: "9rem" }}>
          {months.map((month) => (
            <div key={month.month} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[0.6875rem] tabular-nums text-ink-faint">
                {month.total > 0 ? formatMoney(month.total, language) : ""}
              </span>
              <div
                className="w-full bg-marigold"
                style={{ height: `${Math.max((month.total / peak) * 100, 1)}%` }}
                aria-hidden
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          {months.map((month) => (
            <p
              key={month.month}
              className="flex-1 text-center text-[0.625rem] uppercase tracking-[0.14em] text-ink-faint"
            >
              {new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
                month: "short",
              }).format(new Date(`${month.month}-15T12:00:00`))}
            </p>
          ))}
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("chartNote")}</p>
      </section>

      <WorkRetiredGroup records={retired} />
    </OfficeDraftProvider>
  );
}
