import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import type { StoredRequest } from "@/lib/request-store";
import { Tag } from "./ui";

/**
 * A run of records as a reading table — used both in a client's own history
 * and in Daysi's office, because the two want exactly the same columns and
 * only differ in whose records they hold.
 */
export async function RequestList({
  records,
  locale,
  emptyMessage,
}: {
  records: readonly StoredRequest[];
  locale: Locale;
  emptyMessage: string;
}) {
  const t = await getTranslations("account");

  if (records.length === 0) {
    return (
      <p className="border border-dashed border-line px-6 py-14 text-center text-[0.9375rem] text-ink-faint">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col border-t border-line">
      {records.map((record) => (
        <article
          key={record.reference}
          className="grid gap-3 border-b border-line py-5 sm:grid-cols-[8rem_1fr_auto] sm:items-baseline sm:gap-6"
        >
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.75rem]">{record.reference}</span>
            <time
              className="text-[0.75rem] text-ink-faint"
              dateTime={record.submittedAt}
            >
              {new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(record.submittedAt))}
            </time>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[0.9375rem]">{t(`kind.${record.kind}`)}</p>
            <p className="text-[0.8125rem] leading-relaxed text-ink-faint">
              {summarise(record)}
            </p>
          </div>

          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
            {record.estimate ? (
              <span className="text-[0.9375rem] tabular-nums">
                {formatMoney(record.estimate.total, locale)}
              </span>
            ) : null}
            <Tag tone={record.status === "paid" ? "marigold" : "quiet"}>
              {t(`status.${record.status}`)}
            </Tag>
          </div>
        </article>
      ))}
    </div>
  );
}

/** The one line of detail worth showing without opening anything. */
function summarise(record: StoredRequest): string {
  const values = Object.values(record.details)
    .map((value) => (Array.isArray(value) ? value.join(", ") : String(value)))
    .filter((value) => value.length > 0 && value !== "false");
  return values.slice(0, 2).join(" · ");
}
