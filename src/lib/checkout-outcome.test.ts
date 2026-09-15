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

async function setup() {
  statusMock.mockReset();
  statusMock.mockResolvedValue("unknown");
  vi.doMock("./payments", () => ({
    checkoutPaymentStatus: statusMock,
    isSessionId: (value: string) => value.startsWith("cs_"),
  }));
  const { saveRequest } = await import("./request-store");
  const { thankYouState, LOOKUPS_PER_HOUR } = await import("./checkout-outcome");
  return { saveRequest, thankYouState, LOOKUPS_PER_HOUR };
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
