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
