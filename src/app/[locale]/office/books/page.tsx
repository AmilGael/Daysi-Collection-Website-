import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { loadLedger } from "@/lib/earnings";
import { exportSummary } from "@/lib/books";
import { formatMoney } from "@/lib/money";
import { BooksExport } from "@/components/books-export";
import { officeViewer } from "../_lib/viewer";

/** Books: the year at a glance, and the file her accountant asks for. */
export default async function OfficeBooksPage({
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

  // Ranges an accountant actually asks for, built from today rather than hard
  // coded, so this still offers the right years in 2027.
  const today = new Date();
  const year = today.getFullYear();
  const quarter = Math.floor(today.getMonth() / 3);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const bookPresets = [
    { label: t("booksThisYear"), from: `${year}-01-01`, to: `${year}-12-31` },
    { label: t("booksLastYear"), from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
    {
      label: t("booksThisQuarter"),
      from: iso(new Date(year, quarter * 3, 1)),
      to: iso(new Date(year, quarter * 3 + 3, 0)),
    },
  ];
  const booksSummary = exportSummary(ledger, `${year}-01-01`, `${year}-12-31`);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("booksTitle")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("booksLead")}
        </p>
      </div>
      <p className="text-[0.875rem] text-ink-soft">
        {t("booksSummary", {
          year: String(year),
          invoices: booksSummary.invoices,
          received: formatMoney(booksSummary.received, language),
          outstanding: formatMoney(booksSummary.outstanding, language),
          tax: formatMoney(booksSummary.salesTax, language),
        })}
      </p>
      <BooksExport
        presets={bookPresets}
        initialFrom={`${year}-01-01`}
        initialTo={`${year}-12-31`}
      />
    </section>
  );
}
