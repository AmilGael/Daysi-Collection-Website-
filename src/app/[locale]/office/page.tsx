import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { earningsFrom, loadLedger, monthlyReceived } from "@/lib/earnings";
import { formatMoney } from "@/lib/money";
import { Figure } from "@/components/office/figure";
import { officeViewer } from "./_lib/viewer";

/** Today: what has come in, what is owed, and the last six months at a glance. */
export default async function OfficeTodayPage({
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

  return (
    <>
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
    </>
  );
}
