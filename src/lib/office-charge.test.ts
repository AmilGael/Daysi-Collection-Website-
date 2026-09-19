import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoredRequest } from "./request-store";

/**
 * Charging from the office: one open link per order, never a second page
 * while the first can still be paid, and the row kept in her Hub.
 */

let dir: string;
const create = vi.fn();
const expire = vi.fn();

beforeEach(() => {
  vi.resetModules();
  create.mockReset();
  expire.mockReset();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-charge-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.doMock("./payments", () => ({ createCheckoutSession: create, expireCheckoutSession: expire }));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.doUnmock("./payments");
});

const record = (overrides: Partial<StoredRequest> = {}): StoredRequest => ({
  reference: "ALT-1",
  kind: "alteration",
  submittedAt: "2026-09-18T12:00:00.000Z",
  locale: "es",
  client: { name: "Ana", email: "ana@example.com", phone: "7185550100" },
  details: {},
  status: "new",
  ...overrides,
});

const page = (id: string) => ({
  url: `https://checkout.stripe.test/${id}`,
  id,
  expiresAt: new Date(Date.now() + 23 * 3_600_000).toISOString(),
});

describe("chargeRecord", () => {
  it("makes a card page for the amount, stores the link, and keeps the row in the Hub", async () => {
    create.mockResolvedValueOnce(page("cs_1"));
    const { saveRequest, findRequest, unfinishedCheckout } = await import("./request-store");
    const { chargeRecord } = await import("./office-charge");
    await saveRequest(record());

    const outcome = await chargeRecord("ALT-1", 4500);
    expect(outcome.ok).toBe(true);
    const request = create.mock.calls[0]![0];
    expect(request).toMatchObject({ reference: "ALT-1", customerEmail: "ana@example.com", cardsOnly: true });
    expect(request.estimate.dueNow).toBe(4500);
    expect(request.estimate.salesTax).toBe(0);

    const current = findRequest("ALT-1")!;
    expect(current.paymentLink).toMatchObject({ sessionId: "cs_1", amount: 4500 });
    expect(current.source).toBe("office");
    expect(unfinishedCheckout(current)).toBe(false);
  });

  it("keeps the priced lines when she charges exactly the record's total", async () => {
    create.mockResolvedValueOnce(page("cs_1"));
    const { saveRequest } = await import("./request-store");
    const { estimateCharged } = await import("./pricing");
    const priced = { ...estimateCharged(2800), dueNow: 0, dueOnCollection: 2800 };
    await saveRequest(record({ estimate: priced }));
    const { chargeRecord } = await import("./office-charge");

    await chargeRecord("ALT-1", 2800);
    const sent = create.mock.calls[0]![0].estimate;
    expect(sent.lines).toEqual(priced.lines);
    expect(sent).toMatchObject({ dueNow: 2800, dueOnCollection: 0 });
  });

  it("closes the open link before making a new one", async () => {
    create.mockResolvedValueOnce(page("cs_1")).mockResolvedValueOnce(page("cs_2"));
    expire.mockResolvedValueOnce("expired");
    const { saveRequest, findRequest } = await import("./request-store");
    const { chargeRecord } = await import("./office-charge");
    await saveRequest(record());

    await chargeRecord("ALT-1", 4500);
    await chargeRecord("ALT-1", 5000);
    expect(expire).toHaveBeenCalledWith("cs_1", "ALT-1");
    expect(findRequest("ALT-1")?.paymentLink).toMatchObject({ sessionId: "cs_2", amount: 5000 });
  });

  it("refuses a new link when Stripe cannot say the old one is closed", async () => {
    create.mockResolvedValueOnce(page("cs_1"));
    expire.mockResolvedValueOnce("unknown");
    const { saveRequest, findRequest } = await import("./request-store");
    const { chargeRecord } = await import("./office-charge");
    await saveRequest(record());

    await chargeRecord("ALT-1", 4500);
    expect(await chargeRecord("ALT-1", 5000)).toEqual({ ok: false, error: "old-link-open" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(findRequest("ALT-1")?.paymentLink?.sessionId).toBe("cs_1");
  });

  it("refuses a paid order, a message, and an amount outside the office's range", async () => {
    const { saveRequest } = await import("./request-store");
    const { chargeRecord } = await import("./office-charge");
    await saveRequest(record({ status: "paid" }));
    await saveRequest(record({ reference: "MSG-1", kind: "contact" }));

    expect(await chargeRecord("ALT-1", 4500)).toEqual({ ok: false, error: "not-chargeable" });
    expect(await chargeRecord("MSG-1", 4500)).toEqual({ ok: false, error: "not-chargeable" });
    expect(await chargeRecord("ALT-1", 50)).toEqual({ ok: false, error: "bad-amount" });
    expect(await chargeRecord("NOPE-1", 4500)).toEqual({ ok: false, error: "unknown-reference" });
    expect(create).not.toHaveBeenCalled();
  });

  it("writes nothing when Stripe refuses the page", async () => {
    create.mockResolvedValueOnce(null);
    const { saveRequest, findRequest } = await import("./request-store");
    const { chargeRecord } = await import("./office-charge");
    await saveRequest(record());

    expect(await chargeRecord("ALT-1", 4500)).toEqual({ ok: false, error: "stripe-failed" });
    expect(findRequest("ALT-1")?.paymentLink).toBeUndefined();
  });
});

describe("the payment link email", () => {
  it("names the amount, the link and the reference in the client's language", async () => {
    const { paymentLinkMessage } = await import("./notify");
    const link = { url: "https://checkout.stripe.test/cs_1", amount: 4500, expiresAt: "2026-09-20T15:00:00.000Z" };
    const es = paymentLinkMessage(record(), link);
    expect(es.subject).toContain("ALT-1");
    expect(es.text).toContain("$45");
    expect(es.text).toContain(link.url);
    expect(es.text).toContain("wa.me/");
    const en = paymentLinkMessage(record({ locale: "en" }), link);
    expect(en.subject).toMatch(/^Your payment/);
  });
});
