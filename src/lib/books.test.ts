import { describe, expect, it } from "vitest";
import type { StoredRequest } from "./request-store";
import {
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
    expect(row?.[9]).toBe("TAX");
  });

  it("marks a garment under the exemption as exempt, matching what was charged", () => {
    const [row] = salesRows([record({ estimate: estimate(9500) })], "en");
    expect(row?.[9]).toBe("NON");
  });

  it("never taxes Daysi's time", () => {
    const [row] = salesRows([record({ estimate: estimate(17500, "service") })], "en");
    expect(row?.[9]).toBe("NON");
  });

  it("writes the description in the language she is reading", () => {
    expect(salesRows([record()], "es")[0]?.[5]).toBe("Conjunto Frutera");
    expect(salesRows([record()], "en")[0]?.[5]).toBe("Frutera two-piece");
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
