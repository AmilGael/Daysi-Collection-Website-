import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { currentViewer } from "@/lib/auth/session";
import { earningsFrom, loadLedger, monthlyReceived } from "@/lib/earnings";
import { listRequests, currentRecords } from "@/lib/request-store";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { RequestList } from "@/components/request-list";

/**
 * Daysi's office.
 *
 * Gated twice over: the viewer must be signed in, and their address must be
 * the owner address. A client who guesses the URL gets the same 404 as a page
 * that does not exist — a 403 would confirm there is something here to find.
 */
export default async function OfficePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;

  const viewer = await currentViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);
  if (viewer.role !== "owner") notFound();

  const t = await getTranslations("office");

  const ledger = loadLedger();
  const earnings = earningsFrom(ledger);
  const months = monthlyReceived(ledger, 6, new Date());
  const peak = Math.max(...months.map((month) => month.total), 1);

  const messages = currentRecords(listRequests("contact"));
  const signups = currentRecords(listRequests("premiere-signup"));

  const appointments = ledger.filter((record) => record.kind === "appointment");
  const work = ledger.filter((record) => record.kind !== "appointment");

  return (
    <>
      <PageHeader
        title={t("title", { name: viewer.account.name || "Daysi" })}
        lead={t("lead")}
      />

      <div className="shell flex flex-col gap-16 pb-28">
        <section className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Figure label={t("received")} value={formatMoney(earnings.received, language)} emphasis />
          <Figure label={t("outstanding")} value={formatMoney(earnings.outstanding, language)} />
          <Figure label={t("openJobs")} value={String(earnings.openCount)} />
          <Figure label={t("upcomingSessions")} value={String(appointments.length)} />
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

        <section className="flex flex-col gap-6">
          <h2 className="text-heading">{t("work")}</h2>
          <RequestList records={work} locale={language} emptyMessage={t("noWork")} />
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-heading">{t("sessions")}</h2>
          <RequestList
            records={appointments}
            locale={language}
            emptyMessage={t("noSessions")}
          />
        </section>

        <section className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-6">
            <h2 className="text-heading">{t("messages")}</h2>
            <RequestList records={messages} locale={language} emptyMessage={t("noMessages")} />
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
      </div>
    </>
  );
}

function Figure({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 p-6 ${emphasis ? "bg-ink text-paper" : "bg-paper"}`}>
      <p
        className={`text-[0.625rem] font-medium uppercase tracking-[0.2em] ${
          emphasis ? "text-paper/50" : "text-ink-faint"
        }`}
      >
        {label}
      </p>
      <p className="font-display text-[1.75rem] tabular-nums leading-none">{value}</p>
    </div>
  );
}
