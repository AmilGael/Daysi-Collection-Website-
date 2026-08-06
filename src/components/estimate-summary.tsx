"use client";

import { useLocale, useTranslations } from "next-intl";
import { translate } from "@/content";
import { formatMoney } from "@/lib/money";
import type { Estimate } from "@/lib/pricing";
import type { Locale } from "@/i18n/routing";

/**
 * An estimate, written out the way an invoice would be: every line, the tax,
 * the total, and — the part clients actually want — what has to be paid now
 * versus what is settled later.
 */
export function EstimateSummary({ estimate }: { estimate: Estimate }) {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;

  return (
    <div className="flex flex-col gap-4 border border-line bg-paper p-6">
      <dl className="flex flex-col">
        {estimate.lines.map((line, index) => (
          <div
            key={`${line.label.en}-${index}`}
            className="flex items-start justify-between gap-6 border-b border-line py-3 last:border-b-0"
          >
            <div className="flex flex-col gap-0.5">
              <dt className="text-[0.9375rem]">{translate(line.label, locale)}</dt>
              {line.note ? (
                <dd className="text-[0.8125rem] leading-relaxed text-ink-faint">
                  {translate(line.note, locale)}
                </dd>
              ) : null}
            </div>
            <dd className="shrink-0 tabular-nums">{formatMoney(line.amount, locale)}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-1.5 border-t border-line pt-4 text-[0.875rem]">
        <Row label={t("subtotal")} value={formatMoney(estimate.subtotal, locale)} muted />
        {estimate.salesTax > 0 ? (
          <Row label={t("salesTax")} value={formatMoney(estimate.salesTax, locale)} muted />
        ) : null}
        <Row label={t("total")} value={formatMoney(estimate.total, locale)} emphasis />
      </div>

      <div className="flex flex-col gap-2 bg-paper-warm p-4">
        <Row label={t("dueNow")} value={formatMoney(estimate.dueNow, locale)} emphasis />
        {estimate.dueOnCollection > 0 ? (
          <Row
            label={t("dueOnCollection")}
            value={formatMoney(estimate.dueOnCollection, locale)}
            muted
          />
        ) : null}
        <p className="pt-1 text-[0.8125rem] leading-relaxed text-ink-faint">
          {translate(estimate.dueNowReason, locale)}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-6 ${
        muted ? "text-ink-faint" : ""
      } ${emphasis ? "font-medium text-ink" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
