import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoredRequest, StoredRequestKind } from "./request-store";

/**
 * What Stripe's confirmation is allowed to do to a record. The webhook is the
 * only place money changes a status, so the guards here are the ones standing
 * between a retried delivery and a wrong number in the books.
 */

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-payments-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const record = (
  overrides: Partial<StoredRequest> & Pick<StoredRequest, "reference" | "kind">,
): StoredRequest => ({
  submittedAt: "2026-09-03T12:00:00.000Z",
  locale: "en",
  client: { name: "Ana", email: "ana@example.com" },
  details: {},
  status: "new",
  ...overrides,
});

const lines = (kind: StoredRequestKind): StoredRequest[] =>
  readFileSync(path.join(dir, `${kind}.jsonl`), "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as StoredRequest);

describe("markPaid", () => {
  it("marks the order paid and says the line came from Stripe", async () => {
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    expect(await markPaid("ORD-1")).toBe("marked");

    expect(findRequest("ORD-1")).toMatchObject({ status: "paid", source: "stripe" });
    expect(lines("order")).toHaveLength(2);
  });

  it("finds a commission even though orders are looked at first", async () => {
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    await saveRequest(record({ reference: "COM-1", kind: "commission" }));

    expect(await markPaid("COM-1")).toBe("marked");
    expect(findRequest("COM-1")?.status).toBe("paid");
    expect(findRequest("ORD-1")?.status).toBe("new");
  });

  it("writes nothing for a reference it does not recognise", async () => {
    const { saveRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    expect(await markPaid("ORD-nobody")).toBe("unknown");
    expect(lines("order")).toHaveLength(1);
  });

  it("does not repeat itself when Stripe delivers the same payment twice", async () => {
    const { saveRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    await markPaid("ORD-1");
    expect(await markPaid("ORD-1")).toBe("already-paid");
    expect(lines("order")).toHaveLength(2);
  });

  it("leaves a correction the office made after the payment alone", async () => {
    // Daysi refunds the card in Stripe and closes the order here. A retry of the
    // original delivery must not put the money back.
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    await markPaid("ORD-1");
    await saveRequest(
      record({ reference: "ORD-1", kind: "order", status: "closed", source: "office" }),
    );

    expect(await markPaid("ORD-1")).toBe("already-paid");
    expect(findRequest("ORD-1")?.status).toBe("closed");
    expect(lines("order")).toHaveLength(3);
  });
});

describe("markPaid tells Daysi", () => {
  it("announces the order once Stripe confirms, and only once", async () => {
    vi.doMock("./notify", () => ({ notifyOwner: vi.fn(async () => undefined) }));
    const { saveRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");
    const { notifyOwner } = await import("./notify");

    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    expect(notifyOwner).not.toHaveBeenCalled();

    await markPaid("ORD-1");
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "ORD-1", status: "paid", source: "stripe" }),
    );

    await markPaid("ORD-1");
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("drops the waiting mark from the paid line", async () => {
    vi.doMock("./notify", () => ({ notifyOwner: vi.fn(async () => undefined) }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await markPaid("ORD-1");

    expect(findRequest("ORD-1")).not.toHaveProperty("awaitingPayment");
  });
});

describe("markExpired", () => {
  it("closes a booking whose payment page ran out, so it leaves the calendar and the books", async () => {
    vi.doMock("./notify", () => ({ notifyOwner: vi.fn(async () => undefined) }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markExpired } = await import("./payment-events");

    await saveRequest(
      record({ reference: "CIT-1", kind: "appointment", status: "scheduled", awaitingPayment: true }),
    );
    expect(await markExpired("CIT-1")).toBe("closed");

    expect(findRequest("CIT-1")).toMatchObject({ status: "closed", source: "stripe" });
    expect(findRequest("CIT-1")).not.toHaveProperty("awaitingPayment");
    expect(lines("appointment")).toHaveLength(2);
  });

  it("leaves a paid order alone when Stripe reports its session expired afterwards", async () => {
    vi.doMock("./notify", () => ({ notifyOwner: vi.fn(async () => undefined) }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid, markExpired } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await markPaid("ORD-1");
    expect(await markExpired("ORD-1")).toBe("not-waiting");

    expect(findRequest("ORD-1")?.status).toBe("paid");
    expect(lines("order")).toHaveLength(2);
  });

  it("leaves a record the office has already handled alone", async () => {
    // Daysi took cash and marked it herself; the dead payment page is not news.
    vi.doMock("./notify", () => ({ notifyOwner: vi.fn(async () => undefined) }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markExpired } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await saveRequest(
      record({ reference: "ORD-1", kind: "order", awaitingPayment: true, status: "answered", source: "office" }),
    );
    expect(await markExpired("ORD-1")).toBe("not-waiting");

    expect(findRequest("ORD-1")?.status).toBe("answered");
    expect(lines("order")).toHaveLength(2);
  });

  it("writes nothing for a reference it does not recognise", async () => {
    vi.doMock("./notify", () => ({ notifyOwner: vi.fn(async () => undefined) }));
    const { markExpired } = await import("./payment-events");
    expect(await markExpired("ORD-nobody")).toBe("unknown");
  });
});
