import { describe, expect, it } from "vitest";
import type { StoredRequest } from "./request-store";
import {
  SALES_COLUMNS,
  billableInRange,
  escapeField,
  exportSummary,
  salesCsv,
  salesRows,
  toAmount,
} from "./books";

/**
 * The export is what Daysi's accountant files taxes from, so these cover the
 * things that quietly ruin a return: a mistyped amount, a line taxed that the
 * client was never charged tax on, and a record from the wrong year.
 */

const estimate = (amount: number, taxBasis: "clothing" | "service" = "clothing") => ({
  lines: [{ label: { en: "Frutera two-piece", es: "Conjunto Frutera" }, amount, taxBasis }],
  subtotal: amount,
  salesTax: 0,
  total: amount,
  dueNow: amount,
  dueOnCollection: 0,
  dueNowReason: { en: "", es: "" },
});

const record = (over: Partial<StoredRequest> = {}): StoredRequest =>
  ({
    reference: "ORD-1",
    kind: "order",
    submittedAt: "2026-06-15T12:00:00.000Z",
    locale: "en",
    client: { name: "Ana Ruiz", email: "ana@example.com" },
    details: {},
    estimate: estimate(42500),
    status: "paid",
    ...over,
  }) as StoredRequest;

/** By name, never by position: a new column must not silently move an assertion. */
const column = (row: readonly string[] | undefined, name: (typeof SALES_COLUMNS)[number]) =>
  row?.[SALES_COLUMNS.indexOf(name)];

describe("amounts on the export", () => {
  it("writes cents as plain decimal dollars, never a float", () => {
    expect(toAmount(42500)).toBe("425.00");
    expect(toAmount(2999)).toBe("29.99");
    expect(toAmount(0)).toBe("0.00");
  });
});

describe("spreadsheet safety", () => {
  it("defuses a name that would otherwise run as a formula", () => {
    expect(escapeField("=HYPERLINK(\"http://evil\",\"click\")")).toBe(
      "\"'=HYPERLINK(\"\"http://evil\"\",\"\"click\"\")\"",
    );
    expect(escapeField("+1 718 555 0142")).toBe("\"'+1 718 555 0142\"");
  });

  it("quotes a comma so one client does not become two columns", () => {
    expect(escapeField("Ruiz, Ana")).toBe('"Ruiz, Ana"');
  });

  it("flattens a newline rather than breaking the row in half", () => {
    expect(escapeField("Ana\nRuiz")).toBe('"Ana Ruiz"');
  });
});

describe("the sales file", () => {
  it("marks a garment at or above the $110 exemption as taxable", () => {
    const [row] = salesRows([record()], "en");
    expect(column(row, "ItemTaxCode")).toBe("TAX");
  });

  it("marks a garment under the exemption as exempt, matching what was charged", () => {
    const [row] = salesRows([record({ estimate: estimate(9500) })], "en");
    expect(column(row, "ItemTaxCode")).toBe("NON");
  });

  it("never taxes Daysi's time", () => {
    const [row] = salesRows([record({ estimate: estimate(17500, "service") })], "en");
    expect(column(row, "ItemTaxCode")).toBe("NON");
  });

  it("writes the description in the language she is reading", () => {
    expect(column(salesRows([record()], "es")[0], "ItemDescription")).toBe("Conjunto Frutera");
    expect(column(salesRows([record()], "en")[0], "ItemDescription")).toBe("Frutera two-piece");
  });

  it("notes the list price beside a line a promotion lowered, and taxes it by the lowered piece", () => {
    // 65 % off a $295 set: $103.25 charged, under the $110 exemption.
    const promoted = (amount: number, listAmount: number) =>
      record({
        estimate: {
          ...estimate(amount),
          lines: [{ label: { en: "Sirena shirt dress", es: "Vestido camisero Sirena" }, note: { en: "Size M", es: "Talla M" }, amount, listAmount, taxBasis: "clothing" }],
        },
      });
    const [row] = salesRows([promoted(10325, 29500)], "en");
    expect(column(row, "ItemDescription")).toBe("Sirena shirt dress · Size M (list 295.00)");
    expect(column(row, "ItemAmount")).toBe("103.25");
    expect(column(row, "ItemTaxCode")).toBe("NON");
    // 60 % off leaves $118 a piece, which is taxed.
    expect(column(salesRows([promoted(11800, 29500)], "en")[0], "ItemTaxCode")).toBe("TAX");
  });

  it("leads with a header row so the importer can map the columns", () => {
    const csv = salesCsv([record()], "en", "2026-01-01", "2026-12-31");
    expect(csv.split("\r\n")[0]).toContain('"InvoiceNo"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});

describe("the date window", () => {
  it("keeps a record on the closing day of the range", () => {
    expect(billableInRange([record()], "2026-06-15", "2026-06-15")).toHaveLength(1);
  });

  it("drops a record from another year, so last year's taxes stay filed", () => {
    expect(billableInRange([record()], "2027-01-01", "2027-12-31")).toHaveLength(0);
  });

  it("ignores a record that carries no money", () => {
    expect(
      billableInRange([record({ estimate: undefined })], "2026-01-01", "2026-12-31"),
    ).toHaveLength(0);
  });

  it("reads oldest first, the way a ledger does", () => {
    const older = record({ reference: "ORD-0", submittedAt: "2026-02-01T12:00:00.000Z" });
    const rows = billableInRange([record(), older], "2026-01-01", "2026-12-31");
    expect(rows.map((row) => row.reference)).toEqual(["ORD-0", "ORD-1"]);
  });
});

describe("the summary shown before download", () => {
  it("counts cleared and open money separately, never as one number", () => {
    const summary = exportSummary(
      [record(), record({ reference: "ORD-2", status: "scheduled" })],
      "2026-01-01",
      "2026-12-31",
    );
    expect(summary.invoices).toBe(2);
    expect(summary.received).toBe(42500);
    expect(summary.outstanding).toBe(42500);
  });

  it("leaves a closed job out of both", () => {
    const summary = exportSummary([record({ status: "closed" })], "2026-01-01", "2026-12-31");
    expect(summary.received).toBe(0);
    expect(summary.outstanding).toBe(0);
  });
});

describe("a refunded order on the export", () => {
  it("is neither received nor outstanding in the summary", () => {
    const summary = exportSummary([record({ status: "refunded" })], "2026-01-01", "2026-12-31");
    expect(summary.received).toBe(0);
    expect(summary.outstanding).toBe(0);
  });

  it("says so in the paid column", () => {
    const csv = salesCsv([record({ status: "refunded" })], "en", "2026-01-01", "2026-12-31");
    expect(csv).toContain("Refunded");
    expect(csv).not.toContain("Paid in full");
  });
});

describe("when the money actually cleared", () => {
  it("carries the payment date beside the invoice date, so the export and the office agree", () => {
    // A bank debit clears days after the order. The invoice keeps the order's
    // date, which is what the accountant files; the extra column is what lets
    // the two be reconciled.
    const [row] = salesRows(
      [record({ submittedAt: "2026-09-30T18:00:00.000Z", paidAt: "2026-10-03T09:00:00.000Z" })],
      "en",
    );
    expect(column(row, "PaidDate")).toBe("2026-10-03");
    expect(column(row, "InvoiceDate")).toBe("2026-09-30");
  });

  it("leaves the payment date empty for money that has not come in", () => {
    const [row] = salesRows([record({ status: "new" })], "en");
    expect(column(row, "PaidDate")).toBe("");
  });
});

describe("money the bank refused", () => {
  const refused = record({ status: "paid", source: "stripe", paymentFailed: true });

  it("is owed, not received, in the summary above the file", () => {
    expect(exportSummary([refused], "2026-01-01", "2026-12-31")).toMatchObject({
      received: 0,
      outstanding: 42500,
    });
  });

  it("is not written into the file as paid in full", () => {
    const [row] = salesRows([refused], "en");
    expect(column(row, "Memo")).not.toBe("Paid in full");
    expect(column(row, "PaidDate")).toBe("");
  });
});
