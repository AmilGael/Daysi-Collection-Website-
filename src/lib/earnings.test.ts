import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoredRequest } from "./request-store";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-earnings-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("the active earnings ledger", () => {
  it("removes a retired paid order and restores it", async () => {
    const { earningsFrom, loadLedger } = await import("./earnings");
    const { saveRequest } = await import("./request-store");
    const { setRetired } = await import("./retired");
    const order: StoredRequest = {
      reference: "ORD-PAID",
      kind: "order",
      submittedAt: "2026-09-01T12:00:00.000Z",
      locale: "en",
      client: { name: "Ana", email: "ana@example.com" },
      details: {},
      estimate: {
        lines: [],
        subtotal: 12000,
        salesTax: 0,
        total: 12000,
        dueNow: 12000,
        dueOnCollection: 0,
        dueNowReason: { en: "", es: "" },
      },
      status: "paid",
    };

    await saveRequest(order);
    expect(loadLedger()).toContainEqual(order);
    expect(earningsFrom(loadLedger()).received).toBe(12000);

    await setRetired("request", order.reference, true);
    expect(loadLedger()).toEqual([]);
    expect(earningsFrom(loadLedger()).received).toBe(0);

    await setRetired("request", order.reference, false);
    expect(loadLedger()).toContainEqual(order);
    expect(earningsFrom(loadLedger()).received).toBe(12000);
  });
});

describe("a paid studio design", () => {
  it("counts in the Hub and the books, and its unpaid page does not", async () => {
    const { earningsFrom, loadLedger } = await import("./earnings");
    const { saveRequest } = await import("./request-store");
    const { estimateDesign } = await import("./pricing");
    const design = (reference: string, overrides: Partial<StoredRequest>): StoredRequest => ({
      reference,
      kind: "design",
      submittedAt: "2026-09-18T12:00:00.000Z",
      locale: "es",
      client: { name: "", email: "ana@example.com" },
      details: {},
      estimate: estimateDesign(),
      photoFile: `${reference}.png`,
      status: "new",
      ...overrides,
    });

    await saveRequest(design("DSN-PAID", { status: "paid", source: "stripe", paidVia: "card" }));
    await saveRequest(design("DSN-OPEN", { awaitingPayment: true }));

    expect(loadLedger().map((record) => record.reference)).toEqual(["DSN-PAID"]);
    expect(earningsFrom(loadLedger()).received).toBe(2000);
  });
});

describe("a refunded order", () => {
  it("counts as neither received nor owed", async () => {
    const { earningsFrom } = await import("./earnings");
    const refunded: StoredRequest = {
      reference: "ORD-BACK",
      kind: "order",
      submittedAt: "2026-09-01T12:00:00.000Z",
      locale: "en",
      client: { name: "Ana", email: "ana@example.com" },
      details: {},
      estimate: {
        lines: [],
        subtotal: 12000,
        salesTax: 0,
        total: 12000,
        dueNow: 12000,
        dueOnCollection: 0,
        dueNowReason: { en: "", es: "" },
      },
      status: "refunded",
      source: "stripe",
    };
    expect(earningsFrom([refunded])).toEqual({ received: 0, outstanding: 0, paidCount: 0, openCount: 0 });
  });
});

describe("cleared earnings per month", () => {
  it("counts a bank payment in the month the money arrived, not the month the order was placed", async () => {
    const { monthlyReceived } = await import("./earnings");
    const order: StoredRequest = {
      reference: "ORD-LATE",
      kind: "order",
      submittedAt: "2026-09-30T18:00:00.000Z",
      locale: "en",
      client: { name: "Ana", email: "ana@example.com" },
      details: {},
      estimate: {
        lines: [],
        subtotal: 12000,
        salesTax: 0,
        total: 12000,
        dueNow: 12000,
        dueOnCollection: 0,
        dueNowReason: { en: "", es: "" },
      },
      status: "paid",
      source: "stripe",
      paidVia: "bank",
      paidAt: "2026-10-03T09:00:00.000Z",
    };

    expect(monthlyReceived([order], 2, new Date("2026-10-15T12:00:00Z"))).toEqual([
      { month: "2026-09", total: 0 },
      { month: "2026-10", total: 12000 },
    ]);
  });
});

describe("money the bank refused", () => {
  it("is owed, not earned, whatever the row's status says", async () => {
    // The refusal keeps the status it found, which may be a Pagado Daysi set
    // by hand. Counting that as received books revenue that never arrived.
    const { earningsFrom } = await import("./earnings");
    const refused: StoredRequest = {
      reference: "ORD-BOUNCE",
      kind: "order",
      submittedAt: "2026-09-14T12:00:00.000Z",
      locale: "en",
      client: { name: "Ana", email: "ana@example.com" },
      details: {},
      estimate: {
        lines: [],
        subtotal: 10500,
        salesTax: 0,
        total: 10500,
        dueNow: 10500,
        dueOnCollection: 0,
        dueNowReason: { en: "", es: "" },
      },
      status: "paid",
      source: "stripe",
      paymentFailed: true,
    };

    expect(earningsFrom([refused])).toEqual({
      received: 0,
      outstanding: 10500,
      paidCount: 0,
      openCount: 1,
    });
  });
});

describe("a checkout the client never finished", () => {
  const order = (reference: string, over: Partial<StoredRequest> = {}): StoredRequest => ({
    reference,
    kind: "order",
    submittedAt: "2026-09-16T12:00:00.000Z",
    locale: "es",
    client: { name: "Ana", email: "ana@example.com" },
    details: {},
    estimate: {
      lines: [],
      subtotal: 10500,
      salesTax: 0,
      total: 10500,
      dueNow: 10500,
      dueOnCollection: 0,
      dueNowReason: { en: "", es: "" },
    },
    status: "new",
    ...over,
  });

  it("stays out of Daysi's ledger while the card page is still open", async () => {
    const { earningsFrom, loadLedger } = await import("./earnings");
    const { saveRequest } = await import("./request-store");
    await saveRequest(order("ORD-WAIT", { awaitingPayment: true }));

    expect(loadLedger()).toEqual([]);
    expect(earningsFrom(loadLedger())).toEqual({ received: 0, outstanding: 0, paidCount: 0, openCount: 0 });
  });

  it("stays out once Stripe has closed the page that ran out", async () => {
    const { loadLedger } = await import("./earnings");
    const { saveRequest } = await import("./request-store");
    await saveRequest(order("ORD-GONE", { awaitingPayment: true }));
    await saveRequest(order("ORD-GONE", { status: "closed", source: "stripe" }));

    expect(loadLedger()).toEqual([]);
  });

  it("is kept out of the books export and its summary", async () => {
    const { loadLedger } = await import("./earnings");
    const { exportSummary, salesCsv } = await import("./books");
    const { saveRequest } = await import("./request-store");
    await saveRequest(order("ORD-WAIT", { awaitingPayment: true }));
    await saveRequest(order("ORD-GONE", { awaitingPayment: true }));
    await saveRequest(order("ORD-GONE", { status: "closed", source: "stripe" }));

    expect(salesCsv(loadLedger(), "es", "2026-09-01", "2026-09-30")).not.toContain("ORD-");
    expect(exportSummary(loadLedger(), "2026-09-01", "2026-09-30")).toMatchObject({ invoices: 0, outstanding: 0 });
  });

  it("still shows every order where money moved or Daysi took a hand", async () => {
    const { loadLedger } = await import("./earnings");
    const { saveRequest } = await import("./request-store");
    await saveRequest(order("ORD-PAID", { awaitingPayment: true }));
    await saveRequest(order("ORD-PAID", { status: "paid", source: "stripe", paidVia: "card", paidAt: "2026-09-16T12:05:00.000Z" }));
    await saveRequest(order("ORD-BANK", { awaitingPayment: true }));
    await saveRequest(order("ORD-BANK", { awaitingPayment: "bank", source: "stripe" }));
    await saveRequest(order("ORD-BOUNCE", { source: "stripe", paymentFailed: true }));
    await saveRequest(order("ORD-TOUCHED", { awaitingPayment: true }));
    await saveRequest(order("ORD-TOUCHED", { awaitingPayment: true, status: "answered", source: "office" }));
    await saveRequest(order("ORD-DONE", { status: "closed", source: "office" }));
    await saveRequest(order("ORD-OLD"));

    expect(loadLedger().map((record) => record.reference).sort()).toEqual([
      "ORD-BANK",
      "ORD-BOUNCE",
      "ORD-DONE",
      "ORD-OLD",
      "ORD-PAID",
      "ORD-TOUCHED",
    ]);
  });

  it("keeps an unpaid booking out of the sessions until its deposit is in", async () => {
    const { loadLedger } = await import("./earnings");
    const { saveRequest } = await import("./request-store");
    await saveRequest(order("APT-WAIT", { kind: "appointment", awaitingPayment: true }));

    expect(loadLedger()).toEqual([]);
  });
});
