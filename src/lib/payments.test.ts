import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Estimate } from "./pricing";

/**
 * The two ways `createCheckoutSession` is asked for nothing. Both have to be
 * answered before a Stripe client is ever built: without a key there is no
 * client to build, and Stripe rejects a session for nothing, which the
 * alterations flow would otherwise walk straight into on every submission.
 */

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const estimate = (dueNow: number): Estimate => ({
  lines: [],
  subtotal: dueNow,
  salesTax: 0,
  total: dueNow,
  dueNow,
  dueOnCollection: 0,
  dueNowReason: { en: "Due now", es: "A pagar ahora" },
});

const order = (dueNow: number) => ({
  reference: "ORD-1",
  description: "Daysi Collection · ORD-1",
  estimate: estimate(dueNow),
  customerEmail: "ana@example.com",
  locale: "en" as const,
});

describe("createCheckoutSession", () => {
  it("offers no checkout at all when Stripe is not configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const { paymentsEnabled } = await import("./env");
    const { createCheckoutSession } = await import("./payments");

    expect(paymentsEnabled).toBe(false);
    await expect(createCheckoutSession(order(10500))).resolves.toBeNull();
  });

  it("does not open a session for an amount of nothing", async () => {
    // An alteration is settled on collection after the fit check, so its
    // `dueNow` is zero by design. Reaching Stripe with it would be an error
    // shown to a client who did nothing wrong.
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_not_used_no_call_is_made");
    const { paymentsEnabled } = await import("./env");
    const { createCheckoutSession } = await import("./payments");

    expect(paymentsEnabled).toBe(true);
    await expect(createCheckoutSession(order(0))).resolves.toBeNull();
  });
});

describe("how long a checkout stays open", () => {
  // What Stripe always answers with: the page, its id, and when it closes.
  const createMock = vi.fn(async (_params: unknown) => ({
    url: "https://checkout.stripe.test/s",
    id: "cs_test_1",
    expires_at: 1_790_000_000,
  }));

  async function sessionArgs(
    request: Parameters<typeof order>[0] | undefined,
    extra: { expiresInMinutes?: number; cardsOnly?: boolean } = {},
  ) {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mocked");
    vi.stubEnv("SITE_URL", "https://example.test");
    createMock.mockClear();
    vi.doMock("stripe", () => ({
      default: class {
        checkout = { sessions: { create: createMock } };
      },
    }));
    const { createCheckoutSession } = await import("./payments");
    await createCheckoutSession({ ...order(request ?? 10500), ...extra });
    return createMock.mock.calls[0]![0] as {
      expires_at?: number;
      payment_method_types?: string[];
      success_url?: string;
      cancel_url?: string;
    };
  }

  it("closes a booking's payment page a minute after the hold runs out, clear of Stripe's 30-minute floor", async () => {
    // Stripe refuses an expiry under thirty minutes from *its* clock. Landing
    // exactly on the floor leaves that to the rounding and the network.
    const before = Math.floor(Date.now() / 1000);
    const args = await sessionArgs(undefined, { expiresInMinutes: 30 });
    expect(args.expires_at).toBeGreaterThanOrEqual(before + 30 * 60 + 60);
    expect(args.expires_at).toBeLessThanOrEqual(before + 30 * 60 + 65);
  });

  it("leaves Stripe's own default for an order, which holds nothing", async () => {
    const args = await sessionArgs(undefined);
    expect(args).not.toHaveProperty("expires_at");
  });

  it("sends the client back with the session's id, so the thank-you page can ask whether the money is in", async () => {
    const args = await sessionArgs(undefined);
    expect(args.success_url).toBe(
      "https://example.test/en/checkout/thank-you?reference=ORD-1&session_id={CHECKOUT_SESSION_ID}",
    );
  });

  it("sends a client who backs out with the session's id, so the cancelled page can close it", async () => {
    const args = await sessionArgs(undefined);
    expect(args.cancel_url).toBe(
      "https://example.test/en/checkout/cancelled?reference=ORD-1&session_id={CHECKOUT_SESSION_ID}",
    );
  });

  describe("which ways of paying it offers", () => {
    it("takes only cards when asked to, as a booking is, whose slot hold cannot wait for a bank debit", async () => {
      const args = await sessionArgs(undefined, { cardsOnly: true });
      expect(args.payment_method_types).toEqual(["card"]);
    });

    it("does not let a page expiry alone decide the ways of paying", async () => {
      const args = await sessionArgs(undefined, { expiresInMinutes: 30 });
      expect(args).not.toHaveProperty("payment_method_types");
    });

    it("lets Stripe's dashboard choose for an order, which holds nothing", async () => {
      const args = await sessionArgs(undefined);
      expect(args).not.toHaveProperty("payment_method_types");
    });
  });
});

/**
 * The thank-you page asks Stripe whether the money is in before it says so.
 * Every answer but a clear "paid" or "unpaid" on the right order is "unknown",
 * which the page renders as its plain thanks: the lookup informs a sentence,
 * never the books.
 */
describe("what the thank-you page is told", () => {
  const retrieveMock = vi.fn(async (_id: string, _options?: unknown): Promise<unknown> => ({}));

  // `mockReset`, not `mockClear`: a queued one-shot answer must never leak
  // into the next test through a path that returns before asking Stripe.
  beforeEach(() => {
    retrieveMock.mockReset();
  });

  async function statusOf(sessionId: string, reference: string, key = "sk_test_mocked") {
    vi.stubEnv("STRIPE_SECRET_KEY", key);
    vi.doMock("stripe", () => ({
      default: class {
        checkout = { sessions: { retrieve: retrieveMock } };
      },
    }));
    const { checkoutPaymentStatus } = await import("./payments");
    return checkoutPaymentStatus(sessionId, reference);
  }

  it("says paid when Stripe reports the session paid", async () => {
    retrieveMock.mockResolvedValueOnce({ status: "complete", payment_status: "paid", metadata: { reference: "ORD-1" } });
    expect(await statusOf("cs_test_1", "ORD-1")).toBe("paid");
    expect(retrieveMock.mock.calls[0]![0]).toBe("cs_test_1");
  });

  it("asks with a short deadline and no retries, so the page cannot hang on Stripe", async () => {
    retrieveMock.mockResolvedValueOnce({ status: "complete", payment_status: "paid", metadata: { reference: "ORD-1" } });
    await statusOf("cs_test_1", "ORD-1");
    const options = retrieveMock.mock.calls[0]![1] as { timeout?: number; maxNetworkRetries?: number };
    expect(options.maxNetworkRetries).toBe(0);
    expect(options.timeout).toBeGreaterThan(0);
    expect(options.timeout).toBeLessThanOrEqual(10_000);
  });

  it("says pending while a completed page waits for the bank to send the money", async () => {
    retrieveMock.mockResolvedValueOnce({ status: "complete", payment_status: "unpaid", metadata: { reference: "ORD-1" } });
    expect(await statusOf("cs_test_1", "ORD-1")).toBe("pending");
  });

  it("says unknown for a page that expired or is still open with nothing paid", async () => {
    retrieveMock.mockResolvedValueOnce({ status: "expired", payment_status: "unpaid", metadata: { reference: "ORD-1" } });
    expect(await statusOf("cs_test_1", "ORD-1")).toBe("unknown");
    retrieveMock.mockResolvedValueOnce({ status: "open", payment_status: "unpaid", metadata: { reference: "ORD-1" } });
    expect(await statusOf("cs_test_1", "ORD-1")).toBe("unknown");
  });

  it("matches the order by the client reference when the session carries no metadata", async () => {
    retrieveMock.mockResolvedValueOnce({
      status: "complete",
      payment_status: "paid",
      metadata: {},
      client_reference_id: "ORD-1",
    });
    expect(await statusOf("cs_test_1", "ORD-1")).toBe("paid");
  });

  it("says unknown without asking Stripe when payments are not configured", async () => {
    expect(await statusOf("cs_test_1", "ORD-1", "")).toBe("unknown");
    expect(retrieveMock).not.toHaveBeenCalled();
  });

  it("says unknown for an id that could not be a Stripe session, without asking", async () => {
    expect(await statusOf("abc", "ORD-1")).toBe("unknown");
    expect(retrieveMock).not.toHaveBeenCalled();
  });

  it("says unknown, rather than failing the page, when Stripe cannot be reached", async () => {
    retrieveMock.mockRejectedValueOnce(new Error("connection reset"));
    expect(await statusOf("cs_test_1", "ORD-1")).toBe("unknown");
  });

  it("says unknown when the session belongs to another order", async () => {
    // Otherwise a hand-edited URL could show one order's state under another's number.
    retrieveMock.mockResolvedValueOnce({ status: "complete", payment_status: "paid", metadata: { reference: "ORD-2" } });
    expect(await statusOf("cs_test_1", "ORD-1")).toBe("unknown");
  });
});

/**
 * The cancelled page closes the payment page the client walked away from, so
 * the order is over the moment they say so rather than half an hour later.
 * Only a page that is still open is closed, and only for the order it was
 * made for; everything else is left to the webhook.
 */
describe("closing a payment page the client backed out of", () => {
  const retrieveMock = vi.fn(async (_id: string, _options?: unknown): Promise<unknown> => ({}));
  const expireMock = vi.fn(async (_id: string, _params?: unknown, _options?: unknown): Promise<unknown> => ({}));

  beforeEach(() => {
    retrieveMock.mockReset();
    expireMock.mockReset();
  });

  async function expire(sessionId: string, reference: string, key = "sk_test_mocked") {
    vi.stubEnv("STRIPE_SECRET_KEY", key);
    vi.doMock("stripe", () => ({
      default: class {
        checkout = { sessions: { retrieve: retrieveMock, expire: expireMock } };
      },
    }));
    const { expireCheckoutSession } = await import("./payments");
    return expireCheckoutSession(sessionId, reference);
  }

  const session = (status: string, reference = "ORD-1") => ({ status, metadata: { reference } });

  it("expires an open page that belongs to the order", async () => {
    retrieveMock.mockResolvedValueOnce(session("open"));
    expect(await expire("cs_test_1", "ORD-1")).toBe("expired");
    expect(expireMock.mock.calls[0]![0]).toBe("cs_test_1");
  });

  it("gives Stripe one short try at each step, so the page cannot hang on it", async () => {
    retrieveMock.mockResolvedValueOnce(session("open"));
    await expire("cs_test_1", "ORD-1");
    for (const options of [retrieveMock.mock.calls[0]![1], expireMock.mock.calls[0]![2]]) {
      const { timeout, maxNetworkRetries } = options as { timeout?: number; maxNetworkRetries?: number };
      expect(maxNetworkRetries).toBe(0);
      expect(timeout).toBeGreaterThan(0);
      expect(timeout).toBeLessThanOrEqual(10_000);
    }
  });

  it("says not-open for a page Stripe has already closed, without closing it twice", async () => {
    retrieveMock.mockResolvedValueOnce(session("expired"));
    expect(await expire("cs_test_1", "ORD-1")).toBe("not-open");
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("says not-open when the page closed between the look and the close", async () => {
    retrieveMock.mockResolvedValueOnce(session("open"));
    expireMock.mockRejectedValueOnce(
      Object.assign(new Error("Only Checkout Sessions with a status in [open] can be expired."), {
        type: "StripeInvalidRequestError",
      }),
    );
    expect(await expire("cs_test_1", "ORD-1")).toBe("not-open");
  });

  it("leaves a completed page to the webhook: money may be on its way", async () => {
    retrieveMock.mockResolvedValueOnce(session("complete"));
    expect(await expire("cs_test_1", "ORD-1")).toBe("unknown");
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("closes nothing for a session that belongs to another order", async () => {
    // A hand-edited URL must not close one order under another's number.
    retrieveMock.mockResolvedValueOnce(session("open", "ORD-2"));
    expect(await expire("cs_test_1", "ORD-1")).toBe("mismatch");
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("says unknown without asking Stripe when payments are off or the id could not be a session", async () => {
    expect(await expire("cs_test_1", "ORD-1", "")).toBe("unknown");
    expect(await expire("abc", "ORD-1")).toBe("unknown");
    expect(retrieveMock).not.toHaveBeenCalled();
  });

  it("closes nothing on a made-up id Stripe has never heard of", async () => {
    // Stripe answers an unknown session with the same kind of error it gives
    // for closing a closed page; only the second may close the order.
    retrieveMock.mockRejectedValueOnce(
      Object.assign(new Error("No such checkout.session: 'cs_made_up'"), { type: "StripeInvalidRequestError" }),
    );
    expect(await expire("cs_made_up", "ORD-1")).toBe("unknown");
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("says unknown, rather than failing the page, when Stripe cannot be reached", async () => {
    retrieveMock.mockRejectedValueOnce(new Error("connection reset"));
    expect(await expire("cs_test_1", "ORD-1")).toBe("unknown");

    retrieveMock.mockResolvedValueOnce(session("open"));
    expireMock.mockRejectedValueOnce(new Error("connection reset"));
    expect(await expire("cs_test_1", "ORD-1")).toBe("unknown");
  });
});

describe("the page createCheckoutSession hands back", () => {
  it("carries the session's id and when it closes, for a link Daysi sends", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mocked");
    vi.stubEnv("SITE_URL", "https://example.test");
    vi.doMock("stripe", () => ({
      default: class {
        checkout = {
          sessions: {
            create: vi.fn(async () => ({ url: "https://checkout.stripe.test/s", id: "cs_1", expires_at: 1_790_000_000 })),
          },
        };
      },
    }));
    const { createCheckoutSession } = await import("./payments");
    const page = await createCheckoutSession({ ...order(10500), customerEmail: "" });
    expect(page).toEqual({
      url: "https://checkout.stripe.test/s",
      id: "cs_1",
      expiresAt: new Date(1_790_000_000 * 1000).toISOString(),
    });
  });
});
