import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoredRequest } from "./request-store";

/**
 * When Daysi hears about a request. A record that still has a card payment in
 * front of it is stored but not announced: the announcement comes from Stripe's
 * confirmation, never from the act of filling in the form, so nobody can put an
 * "order" in her inbox by getting as far as the payment page and stopping.
 */

let dir: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-notify-"));
  process.env.DATA_DIR = dir;
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("OWNER_EMAIL", "daysi@example.com");
  fetchMock = vi.fn(async () => ({ ok: true }) as Response);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const record = (overrides: Partial<StoredRequest> = {}): StoredRequest => ({
  reference: "ORD-1",
  kind: "order",
  submittedAt: "2026-09-06T12:00:00.000Z",
  locale: "en",
  client: { name: "Ana", email: "ana@example.com" },
  details: { Pieces: ["Amapola · S × 1"] },
  estimate: {
    lines: [],
    subtotal: 10500,
    salesTax: 0,
    total: 10500,
    dueNow: 10500,
    dueOnCollection: 0,
    dueNowReason: { en: "Due now", es: "A pagar ahora" },
  },
  status: "new",
  ...overrides,
});

const storedLines = (): StoredRequest[] =>
  readFileSync(path.join(dir, "order.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as StoredRequest);

describe("recordRequest", () => {
  it("stores and tells Daysi about a request with nothing to pay first", async () => {
    const { recordRequest } = await import("./notify");

    expect(await recordRequest(record())).toBe(true);

    expect(storedLines()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stores a request waiting on a card payment without telling Daysi yet", async () => {
    const { recordRequest } = await import("./notify");

    expect(await recordRequest(record({ awaitingPayment: true }))).toBe(true);

    expect(storedLines()).toMatchObject([{ reference: "ORD-1", awaitingPayment: true }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports failure when a request waiting on payment could not be stored", async () => {
    // Nothing else will ever announce it: the webhook looks the reference up in
    // the store, and a record that is not there is a payment for nobody.
    // A plain file where the data directory should be: nothing can be created under it.
    writeFileSync(path.join(dir, "blocker"), "");
    process.env.DATA_DIR = path.join(dir, "blocker", "data");
    const { recordRequest } = await import("./notify");

    expect(await recordRequest(record({ awaitingPayment: true }))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("notifyOwner", () => {
  it("says in the subject and the body that a card payment came in", async () => {
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record({ status: "paid", source: "stripe" }));

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      subject: string;
      text: string;
    };
    expect(body.subject).toContain("PAID");
    expect(body.text).toContain("Paid by card");
    expect(body.text).toContain("$105");
  });

  it("does not claim a payment for a request that was not paid", async () => {
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record());

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      subject: string;
      text: string;
    };
    expect(body.subject).not.toContain("PAID");
    expect(body.text).not.toContain("Paid by card");
  });
});
