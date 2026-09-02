"use client";

import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import type { StoredRequest } from "@/lib/request-store";
import type { WorkChange } from "@/lib/office-validation";
import { Pending } from "@/components/office/confirm-bar";
import { RetireButton } from "@/components/office/retired-group";
import { useOfficeDraft } from "@/components/office/use-office-draft";

const STATUSES = ["new", "answered", "scheduled", "paid", "closed"] as const;

/**
 * The office's working copy of the request table: the same columns a client
 * sees in their own history, plus the editable status. Changes stay in the
 * tab draft until Daysi confirms them together.
 */
export function OfficeRequestList({
  records,
  locale,
  emptyMessage,
}: {
  records: readonly StoredRequest[];
  locale: Locale;
  emptyMessage: string;
}) {
  const t = useTranslations("account");
  const to = useTranslations("office");
  const draft = useOfficeDraft<WorkChange>();

  if (records.length === 0) {
    return (
      <p className="border border-dashed border-line px-6 py-14 text-center text-[0.9375rem] text-ink-faint">
        {emptyMessage}
      </p>
    );
  }

  function setStatus(record: StoredRequest, status: StoredRequest["status"]) {
    const key = `request:${record.reference}`;
    if (status === record.status) {
      draft.unstage(key);
      return;
    }
    draft.stage(key, {
      wire: {
        type: "request-status",
        key,
        kind: record.kind,
        reference: record.reference,
        status,
      },
    });
  }

  return (
    <div className="flex flex-col border-t border-line">
      {records.map((record) => {
        const pending = draft.pending(`request:${record.reference}`);
        const status = pending?.change.wire.type === "request-status"
          ? pending.change.wire.status
          : record.status;
        const retiring = pending?.change.wire.type === "retire";
        const key = `request:${record.reference}`;
        return (
        <article
          key={record.reference}
          className={`grid gap-3 border-b border-line py-5 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-6 ${retiring ? "opacity-50" : ""}`}
        >
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.75rem]">{record.reference}</span>
            <time className="text-[0.75rem] text-ink-faint" dateTime={record.submittedAt}>
              {new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(record.submittedAt))}
            </time>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-[0.9375rem]">
              {t(`kind.${record.kind}`)} · {record.client.name || record.client.email}
            </p>
            <p className="text-[0.8125rem] leading-relaxed text-ink-faint">
              {summarise(record)}
            </p>
            {pending ? (
              <span className="flex flex-wrap items-center gap-3">
                <Pending confirming={pending.confirming} error={pending.error} count={pending.count} />
                <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
                  {to("removePending")}
                </button>
              </span>
            ) : (
              <RetireButton
                name={record.reference}
                prompt={to("retireRequestConfirm", { name: record.reference })}
                onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: record.reference } })}
              />
            )}
          </div>

          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
            {record.estimate ? (
              <span className="text-[0.9375rem] tabular-nums">
                {formatMoney(record.estimate.total, locale)}
              </span>
            ) : null}
            <label className="flex items-center gap-2">
              <span className="sr-only">{to("statusLabel")}</span>
              <select
                value={status}
                disabled={retiring}
                onChange={(event) =>
                  setStatus(record, event.target.value as StoredRequest["status"])
                }
                className="border border-line bg-paper px-3 py-1.5 text-[0.8125rem] disabled:opacity-50"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </article>
        );
      })}
    </div>
  );
}

function summarise(record: StoredRequest): string {
  const values = Object.values(record.details)
    .map((value) => (Array.isArray(value) ? value.join(", ") : String(value)))
    .filter((value) => value.length > 0 && value !== "false");
  return values.slice(0, 2).join(" · ");
}
