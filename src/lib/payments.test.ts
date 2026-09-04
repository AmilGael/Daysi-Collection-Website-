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
