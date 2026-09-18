import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoredRequest } from "./request-store";

/**
 * What the thank-you page is allowed to say. The store is the first word:
 * the webhook writes what Stripe confirmed, and the page reads that. Stripe
 * is asked only in the gap before the webhook lands, and never more than a
 * few times an hour from one address.
 */

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-thanks-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const record = (overrides: Partial<StoredRequest> = {}): StoredRequest => ({
  reference: "ORD-1",
  kind: "order",
  submittedAt: "2026-09-09T12:00:00.000Z",
  locale: "en",
  client: { name: "Ana", email: "ana@example.com" },
  details: {},
  status: "new",
  ...overrides,
});

const statusMock = vi.fn(async (_id: string, _reference: string): Promise<"paid" | "pending" | "unknown"> => "unknown");
const expireMock = vi.fn(
  async (_id: string, _reference: string): Promise<"expired" | "not-open" | "mismatch" | "unknown"> => "unknown",
);

async function setup() {
  statusMock.mockReset();
  statusMock.mockResolvedValue("unknown");
  expireMock.mockReset();
  expireMock.mockResolvedValue("expired");
  // The real `isSessionId` and `referenceOf`; only the calls to Stripe are stood in for.
  vi.doMock("./payments", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./payments")>()),
    checkoutPaymentStatus: statusMock,
    expireCheckoutSession: expireMock,
  }));
  const { requestVersions, saveRequest } = await import("./request-store");
  const { cancelledState, thankYouState, LOOKUPS_PER_HOUR } = await import("./checkout-outcome");
  return { requestVersions, saveRequest, cancelledState, thankYouState, LOOKUPS_PER_HOUR };
}

describe("thankYouState", () => {
  it("says paid from the store alone once the webhook has written the payment", async () => {
    const { saveRequest, thankYouState } = await setup();
    await saveRequest(record({ status: "paid", source: "stripe", paidVia: "card" }));

    expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" })).toBe("paid");
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("does not call a status Daysi set by hand a confirmed payment", async () => {
    // The page would otherwise promise a Stripe receipt for cash she took
    // in the shop, and nothing would ever arrive.
    const { saveRequest, thankYouState } = await setup();
    await saveRequest(record({ status: "paid", source: "office" }));

    expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" })).toBe("unknown");
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("spends no lookup on an id that could not be a Stripe session", async () => {
    const { saveRequest, thankYouState, LOOKUPS_PER_HOUR } = await setup();
    await saveRequest(record({ awaitingPayment: true }));
    statusMock.mockResolvedValue("pending");

    for (let hit = 0; hit < LOOKUPS_PER_HOUR + 2; hit += 1) {
      expect(await thankYouState({ reference: "ORD-1", sessionId: "abc", caller: "budget" })).toBe("unknown");
    }
    expect(statusMock).not.toHaveBeenCalled();
    expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "budget" })).toBe("pending");
  });

  it("says pending from the store while the bank is sending the money", async () => {
    const { saveRequest, thankYouState } = await setup();
    await saveRequest(record({ awaitingPayment: "bank", source: "stripe" }));

    expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" })).toBe("pending");
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("says failed even when the refusal landed on a row marked paid by hand", async () => {
    const { saveRequest, thankYouState } = await setup();
    await saveRequest(record({ status: "paid", source: "stripe", paymentFailed: true }));

    expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" })).toBe("failed");
  });

  it("says failed once the bank has refused the payment", async () => {
    const { saveRequest, thankYouState } = await setup();
    await saveRequest(record({ status: "closed", source: "stripe", paymentFailed: true }));

    expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" })).toBe("failed");
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("asks Stripe only in the moment before the webhook lands, and passes its answer on", async () => {
    const { saveRequest, thankYouState } = await setup();
    await saveRequest(record({ awaitingPayment: true }));
    statusMock.mockResolvedValueOnce("pending");

    expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" })).toBe("pending");
    expect(statusMock).toHaveBeenCalledWith("cs_test_1", "ORD-1");
  });

  it("says unknown, without asking, when there is no session id to ask about", async () => {
    const { saveRequest, thankYouState } = await setup();
    await saveRequest(record({ awaitingPayment: true }));

    expect(await thankYouState({ reference: "ORD-1", caller: "a" })).toBe("unknown");
    expect(await thankYouState({ reference: "ORD-1", sessionId: ["cs_a", "cs_b"], caller: "a" })).toBe("unknown");
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("says unknown, without asking, for a reference the store does not know", async () => {
    const { thankYouState } = await setup();

    expect(await thankYouState({ reference: "ORD-nobody", sessionId: "cs_test_1", caller: "a" })).toBe("unknown");
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("says unknown for a record that is neither paid, waiting nor refused", async () => {
    const { saveRequest, thankYouState } = await setup();
    await saveRequest(record({ status: "closed", source: "stripe" }));

    expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" })).toBe("unknown");
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("stops asking Stripe for one address after a few lookups an hour", async () => {
    const { saveRequest, thankYouState, LOOKUPS_PER_HOUR } = await setup();
    await saveRequest(record({ awaitingPayment: true }));
    statusMock.mockResolvedValue("pending");

    for (let hit = 0; hit < LOOKUPS_PER_HOUR; hit += 1) {
      expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "loop" })).toBe("pending");
    }
    expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "loop" })).toBe("unknown");
    expect(statusMock).toHaveBeenCalledTimes(LOOKUPS_PER_HOUR);

    // Another address is not held back by the first one's excess.
    expect(await thankYouState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "other" })).toBe("pending");
  });
});

/**
 * A client who presses Stripe's back arrow has said no. The cancelled page
 * closes the payment page and the record there and then, so the order never
 * sits as "Pago pendiente" in their own history for the half hour until
 * Stripe's own expiry. Only the client's untouched waiting line is closed;
 * whatever Stripe or Daysi has written stands.
 */
describe("cancelledState", () => {
  it("closes an open card page and expires the session", async () => {
    const { requestVersions, saveRequest, cancelledState } = await setup();
    await saveRequest(record({ awaitingPayment: true }));

    expect(await cancelledState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" })).toBe("closed");
    expect(expireMock).toHaveBeenCalledWith("cs_test_1", "ORD-1");
    const current = requestVersions("ORD-1").at(-1);
    expect(current).toMatchObject({ status: "closed", source: "stripe" });
    expect(current).not.toHaveProperty("awaitingPayment");
  });

  it("closes the record when Stripe had already closed the page", async () => {
    const { requestVersions, saveRequest, cancelledState } = await setup();
    await saveRequest(record({ awaitingPayment: true }));
    expireMock.mockResolvedValueOnce("not-open");

    expect(await cancelledState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" })).toBe("closed");
    expect(requestVersions("ORD-1").at(-1)).toMatchObject({ status: "closed", source: "stripe" });
  });

  it("writes nothing when Stripe or Daysi already wrote", async () => {
    const { requestVersions, saveRequest, cancelledState } = await setup();
    const settled = [
      record({ reference: "ORD-PAID", status: "paid", source: "stripe", paidVia: "card" }),
      record({ reference: "ORD-BANK", awaitingPayment: "bank", source: "stripe" }),
      record({ reference: "ORD-GONE", status: "closed", source: "stripe" }),
      record({ reference: "ORD-HERS", awaitingPayment: true, status: "answered", source: "office" }),
      record({ reference: "ORD-FORM" }),
    ];
    for (const line of settled) await saveRequest(line);

    for (const line of settled) {
      expect(await cancelledState({ reference: line.reference, sessionId: "cs_test_1", caller: "a" })).toBe(
        "already-closed",
      );
      expect(requestVersions(line.reference)).toHaveLength(1);
    }
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("says unknown, and asks nothing, for a reference the store does not know", async () => {
    const { cancelledState } = await setup();

    expect(await cancelledState({ reference: "ORD-nobody", sessionId: "cs_test_1", caller: "a" })).toBe("unknown");
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("spends no lookup on a bad id", async () => {
    const { requestVersions, saveRequest, cancelledState, LOOKUPS_PER_HOUR } = await setup();
    await saveRequest(record({ awaitingPayment: true }));

    for (let hit = 0; hit < LOOKUPS_PER_HOUR + 2; hit += 1) {
      expect(await cancelledState({ reference: "ORD-1", sessionId: "abc", caller: "budget" })).toBe("unknown");
    }
    expect(await cancelledState({ reference: "ORD-1", caller: "budget" })).toBe("unknown");
    expect(await cancelledState({ reference: "ORD-1", sessionId: ["cs_a", "cs_b"], caller: "budget" })).toBe(
      "unknown",
    );
    expect(expireMock).not.toHaveBeenCalled();
    expect(requestVersions("ORD-1")).toHaveLength(1);

    expect(await cancelledState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "budget" })).toBe("closed");
  });

  it("leaves the record on a mismatch", async () => {
    const { requestVersions, saveRequest, cancelledState } = await setup();
    await saveRequest(record({ awaitingPayment: true }));
    expireMock.mockResolvedValueOnce("mismatch");

    expect(await cancelledState({ reference: "ORD-1", sessionId: "cs_other", caller: "a" })).toBe("unknown");
    expect(requestVersions("ORD-1")).toHaveLength(1);
    expect(requestVersions("ORD-1")[0]).toMatchObject({ awaitingPayment: true });
  });

  it("leaves the record when Stripe could not say, for the webhook to settle", async () => {
    const { requestVersions, saveRequest, cancelledState } = await setup();
    await saveRequest(record({ awaitingPayment: true }));
    expireMock.mockResolvedValueOnce("unknown");

    expect(await cancelledState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" })).toBe("unknown");
    expect(requestVersions("ORD-1")).toHaveLength(1);
  });

  it("stops asking Stripe for one address after a few lookups an hour", async () => {
    const { saveRequest, cancelledState, LOOKUPS_PER_HOUR } = await setup();
    await saveRequest(record({ awaitingPayment: true }));
    expireMock.mockResolvedValue("unknown");

    for (let hit = 0; hit < LOOKUPS_PER_HOUR; hit += 1) {
      await cancelledState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "loop" });
    }
    expect(await cancelledState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "loop" })).toBe("unknown");
    expect(expireMock).toHaveBeenCalledTimes(LOOKUPS_PER_HOUR);

    // Another address is not held back by the first one's excess.
    expireMock.mockResolvedValue("expired");
    expect(await cancelledState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "other" })).toBe("closed");
  });

  it("makes the later expired webhook a no-op", async () => {
    const { requestVersions, saveRequest, cancelledState } = await setup();
    await saveRequest(record({ awaitingPayment: true }));
    await cancelledState({ reference: "ORD-1", sessionId: "cs_test_1", caller: "a" });
    expect(requestVersions("ORD-1")).toHaveLength(2);

    const { applyPaymentEvent } = await import("./payment-events");
    const expired = {
      id: "evt_1",
      type: "checkout.session.expired",
      created: 1_789_000_000,
      data: { object: { id: "cs_test_1", metadata: { reference: "ORD-1" }, client_reference_id: "ORD-1" } },
    } as unknown as Parameters<typeof applyPaymentEvent>[0];

    expect(await applyPaymentEvent(expired)).toBe("not-waiting");
    expect(requestVersions("ORD-1")).toHaveLength(2);
  });
});
