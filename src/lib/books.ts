import { translate } from "@/content";
import type { Locale } from "@/i18n/routing";
import { isTaxable } from "./pricing";
import type { StoredRequest } from "./request-store";

/**
 * The books, as a file Daysi can hand to an accountant.
 *
 * QuickBooks Online costs about $35 a month, and the PRD promises her a total
 * ongoing cost of roughly the price of a domain name (Section 15). So rather
 * than a subscription and an OAuth app, this writes the one artefact that
 * bookkeeping actually needs: a line-item sales file in the shape QuickBooks'
 * invoice importer expects, which every other accounting package — and every
 * accountant — reads just as happily.
 *
 * One row per estimate line, with the invoice fields repeated across the rows
 * of an invoice. That repetition is not redundancy; it is the format QuickBooks
 * asks for, because it builds a multi-line invoice out of consecutive rows
 * sharing an InvoiceNo.
 *
 * Nothing here re-derives tax. `isTaxable` comes from pricing.ts, so the code
 * stamped on a line is the same rule that produced the amount the client paid.
 */

export const SALES_COLUMNS = [
  "InvoiceNo",
  "Customer",
  "CustomerEmail",
  "InvoiceDate",
  "DueDate",
  "ItemDescription",
  "ItemQuantity",
  "ItemRate",
  "ItemAmount",
  "ItemTaxCode",
  "Kind",
  "Status",
  "Memo",
] as const;

/** Cents to the plain decimal accounting software expects: 12500 -> "125.00". */
export function toAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * A leading `=`, `+`, `-`, `@` or control character turns a spreadsheet cell
 * into a formula when the file is opened. Client names and emails are typed by
 * strangers, so every field is defused before it is quoted.
 */
export function escapeField(value: string): string {
  const flattened = value.replace(/[\r\n\t]+/g, " ").trim();
  const defused = /^[=+\-@]/.test(flattened) ? `'${flattened}` : flattened;
  return `"${defused.replace(/"/g, '""')}"`;
}

export function toCsv(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  return [columns, ...rows].map((row) => row.map(escapeField).join(",")).join("\r\n");
}

/** Records that carry money, inside the window, oldest first — how books read. */
export function billableInRange(
  records: readonly StoredRequest[],
  from: string,
  to: string,
): StoredRequest[] {
  return records
    .filter((record) => record.estimate && record.estimate.total > 0)
    .filter((record) => {
      const day = record.submittedAt.slice(0, 10);
      return day >= from && day <= to;
    })
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export function salesRows(
  records: readonly StoredRequest[],
  locale: Locale,
): string[][] {
  return records.flatMap((record) => {
    const estimate = record.estimate;
    if (!estimate) return [];
    const day = record.submittedAt.slice(0, 10);

    return estimate.lines.map((line) => {
      const note = line.note ? translate(line.note, locale) : "";
      const label = translate(line.label, locale);
      return [
        record.reference,
        record.client.name || record.client.email,
        record.client.email,
        day,
        day,
        note ? `${label} — ${note}` : label,
        "1",
        toAmount(line.amount),
        toAmount(line.amount),
        isTaxable(line) ? "TAX" : "NON",
        record.kind,
        record.status,
        record.status === "paid" ? "Paid in full" : "Open",
      ];
    });
  });
}

export function salesCsv(
  records: readonly StoredRequest[],
  locale: Locale,
  from: string,
  to: string,
): string {
  return toCsv(SALES_COLUMNS, salesRows(billableInRange(records, from, to), locale));
}

export function exportFilename(from: string, to: string): string {
  return `daysi-collection-sales-${from}-to-${to}.csv`;
}

/** What the office shows before she downloads, so the file is never a surprise. */
export function exportSummary(
  records: readonly StoredRequest[],
  from: string,
  to: string,
): { invoices: number; lines: number; received: number; outstanding: number; salesTax: number } {
  const inRange = billableInRange(records, from, to);
  let received = 0;
  let outstanding = 0;
  let salesTax = 0;
  let lines = 0;

  for (const record of inRange) {
    const estimate = record.estimate;
    if (!estimate) continue;
    lines += estimate.lines.length;
    salesTax += estimate.salesTax;
    if (record.status === "paid") received += estimate.total;
    else if (record.status !== "closed") outstanding += estimate.total;
  }

  return { invoices: inRange.length, lines, received, outstanding, salesTax };
}
