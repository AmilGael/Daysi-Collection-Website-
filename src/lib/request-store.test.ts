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

  it("requestsForAccount leaves out an open card page and a Stripe-closed one, keeps bank-pending and office-touched", async () => {
    // A card page the client backed out of is not an order, in their own
    // history any more than in Daysi's office.
    const { requestsForAccount, saveRequest } = await import("./request-store");
    const line = (reference: string, overrides: Partial<StoredRequest>): StoredRequest => ({
      ...request("new"),
      reference,
      ...overrides,
    });

    await saveRequest(line("ORD-OPEN", { awaitingPayment: true }));
    await saveRequest(line("ORD-CLOSED", { awaitingPayment: true }));
    await saveRequest(line("ORD-CLOSED", { status: "closed", source: "stripe" }));
    await saveRequest(line("ORD-BANK", { awaitingPayment: true }));
    await saveRequest(line("ORD-BANK", { awaitingPayment: "bank", source: "stripe" }));
    await saveRequest(line("ORD-HERS", { awaitingPayment: true }));
    await saveRequest(line("ORD-HERS", { awaitingPayment: true, status: "answered", source: "office" }));
    await saveRequest(line("ORD-PAID", { status: "paid", source: "stripe", paidVia: "card" }));

    const references = requestsForAccount({ id: "account-1", email: "ana@example.com" }, ["order"]).map(
      (record) => record.reference,
    );
    expect(references.sort()).toEqual(["ORD-BANK", "ORD-HERS", "ORD-PAID"]);
  });

  it("returns empty history for an unknown reference", async () => {
    const { findRequest, requestVersions } = await import("./request-store");
    expect(requestVersions("ORD-UNKNOWN")).toEqual([]);
    expect(findRequest("ORD-UNKNOWN")).toBeUndefined();
  });
});

/**
 * The office photo route turns a reference off the network into a file on
 * disk. The name on disk is never taken from the request: it is the one the
 * record carries, and only when it is a name this server issued for that very
 * record — anything else is no photo at all.
 */
describe("resolveRequestPhoto", () => {
  const design = (photoFile: string): StoredRequest => ({
    ...request("new"),
    reference: "DSN-ACDEFGH3",
    kind: "design",
    photoFile,
  });

  it("finds the photo stored for a record, and says what type it is", async () => {
    const { requestPhotoPath, resolveRequestPhoto, saveRequest } = await import("./request-store");
    await saveRequest(design("DSN-ACDEFGH3.png"));

    expect(resolveRequestPhoto("DSN-ACDEFGH3")).toEqual({
      file: path.join(dir, "photos", "DSN-ACDEFGH3.png"),
      contentType: "image/png",
    });
    expect(requestPhotoPath("DSN-ACDEFGH3.png")).toBe(path.join(dir, "photos", "DSN-ACDEFGH3.png"));
  });

  it("accepts every type saveRequestPhoto writes", async () => {
    const { resolveRequestPhoto, saveRequest } = await import("./request-store");
    const types = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
    for (const [extension, contentType] of Object.entries(types)) {
      await saveRequest(design(`DSN-ACDEFGH3.${extension}`));
      expect(resolveRequestPhoto("DSN-ACDEFGH3")?.contentType).toBe(contentType);
    }
  });

  it("refuses a path, and a reference with no record", async () => {
    const { resolveRequestPhoto, saveRequest } = await import("./request-store");
    await saveRequest(design("DSN-ACDEFGH3.png"));

    expect(resolveRequestPhoto("../x")).toBeNull();
    expect(resolveRequestPhoto("../photos/DSN-ACDEFGH3.png")).toBeNull();
    expect(resolveRequestPhoto("DSN-NOBODY00")).toBeNull();
    expect(resolveRequestPhoto("")).toBeNull();
  });

  it("refuses a record with no photo", async () => {
    const { resolveRequestPhoto, saveRequest } = await import("./request-store");
    await saveRequest(request("new"));

    expect(resolveRequestPhoto("ORD-TEST")).toBeNull();
  });

  it("refuses a photo name this server did not issue for that record", async () => {
    const { resolveRequestPhoto, saveRequest } = await import("./request-store");
    for (const photoFile of [
      "../../accounts.jsonl",
      "/etc/passwd",
      "DSN-ACDEFGH3.svg",
      "DSN-ACDEFGH3.png/../../accounts.jsonl",
      "ALT-ACDEFGH3.png",
      "DSN-ACDEFGH3",
    ]) {
      await saveRequest(design(photoFile));
      expect(resolveRequestPhoto("DSN-ACDEFGH3"), photoFile).toBeNull();
    }
  });
});

describe("who marks a status line", () => {
  const source = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
  it("is the office on the work action and Stripe on the payment, and nobody on a client submission", () => {
    expect(source("src/app/[locale]/office/work/actions.ts")).toContain('source: "office"');
    const marks = source("src/lib/payment-events.ts");
    expect(marks).toContain('status: "paid"');
    expect(marks).toContain('source: "stripe"');
    expect(source("src/lib/notify.ts")).not.toMatch(/\bsource:/);
  });
});
