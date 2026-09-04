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
