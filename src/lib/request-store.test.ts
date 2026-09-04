import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoredRequest } from "./request-store";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-requests-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const request = (status: StoredRequest["status"]): StoredRequest => ({
  reference: "ORD-TEST",
  kind: "order",
  submittedAt: "2026-09-01T12:00:00.000Z",
  locale: "en",
  accountId: "account-1",
  client: { name: "Ana", email: "ana@example.com" },
  details: {},
  status,
});

describe("active and manageable requests", () => {
  it("uses the newest line and removes retired requests from active reads", async () => {
    const {
      activeRequests,
      findRequest,
      manageableRequests,
      requestVersions,
      requestsForAccount,
      saveRequest,
    } = await import("./request-store");
    const { setRetired } = await import("./retired");

    await saveRequest(request("new"));
    await saveRequest(request("answered"));
    await saveRequest(request("paid"));
    expect(activeRequests("order")).toHaveLength(1);
    expect(activeRequests("order")[0]?.status).toBe("paid");
    expect(requestVersions("ORD-TEST").map((record) => record.status)).toEqual([
      "new",
      "answered",
      "paid",
    ]);
    expect(findRequest("ORD-TEST")?.status).toBe("paid");

    await setRetired("request", "ORD-TEST", true);
    expect(activeRequests("order")).toEqual([]);
    expect(manageableRequests("order")).toContainEqual(
      expect.objectContaining({ reference: "ORD-TEST", status: "paid", retired: true }),
    );
    expect(
      requestsForAccount({ id: "account-1", email: "ana@example.com" }, ["order"]),
    ).toEqual([]);
  });

  it("returns empty history for an unknown reference", async () => {
    const { findRequest, requestVersions } = await import("./request-store");
    expect(requestVersions("ORD-UNKNOWN")).toEqual([]);
    expect(findRequest("ORD-UNKNOWN")).toBeUndefined();
  });
});

describe("who marks a status line", () => {
  const source = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
  it("is the office on the work action and Stripe on the payment, and nobody on a client submission", () => {
    expect(source("src/app/[locale]/office/work/actions.ts")).toContain('source: "office"');
    expect(source("src/lib/payment-events.ts")).toContain('status: "paid", source: "stripe"');
    expect(source("src/lib/notify.ts")).not.toMatch(/\bsource:/);
  });
});
