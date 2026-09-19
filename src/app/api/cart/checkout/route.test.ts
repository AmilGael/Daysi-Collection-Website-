import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * An abandoned cart must close itself. Without an expiry Stripe keeps the
 * payment page open for a day, and until it closes the order is neither
 * sold nor gone.
 */

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  })),
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("@/lib/auth/session", () => ({ currentViewer: vi.fn(async () => null) }));
vi.mock("@/lib/payments", () => ({
  createCheckoutSession: vi.fn(async () => ({ url: "https://checkout.stripe.test/session" })),
}));

let dir: string;

beforeEach(() => {
  vi.resetModules();
  jar.clear();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-cart-checkout-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function firstStyle() {
  const { styles } = await import("@/content");
  return styles.find((candidate) => candidate.isPublished)!;
}

async function checkout(overrides: Record<string, unknown> = {}) {
  const { writeCart } = await import("@/lib/cart");
  const style = await firstStyle();
  await writeCart({ lines: [{ styleSlug: style.slug, sizeId: "s", customize: false, quantity: 1 }] });

  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost:3000/api/cart/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        name: "Ana Pérez",
        email: "ana@example.com",
        phone: "9175550100",
        preferredContact: "email",
        locale: "es",
        notes: "",
        acceptedTerms: true,
        ...overrides,
      }),
    }),
  );
}

describe("paying for a cart", () => {
  it("closes the payment page after the same half hour a booking gets", async () => {
    const response = await checkout();
    expect(response.status).toBe(200);

    const { createCheckoutSession } = await import("@/lib/payments");
    const { CHECKOUT_HOLD_MINUTES } = await import("@/lib/availability");
    expect(CHECKOUT_HOLD_MINUTES).toBe(30);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInMinutes: CHECKOUT_HOLD_MINUTES }),
    );
  });

  it("still lets a bank debit finish, since it completes the page in time", async () => {
    await checkout();

    const { createCheckoutSession } = await import("@/lib/payments");
    const request = vi.mocked(createCheckoutSession).mock.calls[0]![0];
    expect(request.cardsOnly).toBeUndefined();
  });
});

/**
 * Only the email is required: a guest who leaves no name and no phone can
 * still place an order, and Daysi replies by email since that is the only
 * way she has to reach them.
 */
describe("a guest who gives only an email", () => {
  it("takes the order with no name and no phone at all", async () => {
    const response = await checkout({ name: undefined, phone: undefined, preferredContact: undefined });

    expect(response.status).toBe(200);
  });

  it("refuses to promise a WhatsApp reply when there is no phone to write to", async () => {
    const response = await checkout({ phone: undefined, preferredContact: "whatsapp" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "phone-required" });
  });
});

/**
 * Only a paid checkout becomes an order. With Stripe off there is no way to
 * pay, so nothing is written; with Stripe on but no page to send the client
 * to, their cart stays where it was and Daysi is never told.
 */
describe("when there is no payment page", () => {
  it("answers 503 payments-off and records nothing when Stripe is off", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    const response = await checkout();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "payments-off" });
    const { listRequests } = await import("@/lib/request-store");
    expect(listRequests("order")).toEqual([]);
    const { readCart } = await import("@/lib/cart");
    expect((await readCart()).lines).toHaveLength(1);
    const { createCheckoutSession } = await import("@/lib/payments");
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("keeps the cart and answers 502 when Stripe gives no page", async () => {
    const { createCheckoutSession } = await import("@/lib/payments");
    vi.mocked(createCheckoutSession).mockResolvedValueOnce(null);

    const response = await checkout();

    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string; reference: string };
    expect(body.error).toBe("checkout-unavailable");
    const { readCart } = await import("@/lib/cart");
    expect((await readCart()).lines).toHaveLength(1);
    // Closed as an unfinished checkout: Daysi never hears of it, and every list leaves it out.
    const { findRequest, unfinishedCheckout } = await import("@/lib/request-store");
    const record = findRequest(body.reference)!;
    expect(record.status).toBe("closed");
    expect(unfinishedCheckout(record)).toBe(true);
  });

  it("keeps the cart and answers 502 when Stripe cannot be reached", async () => {
    const { createCheckoutSession } = await import("@/lib/payments");
    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new Error("connection reset"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await checkout();

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "checkout-unavailable" });
    const { readCart } = await import("@/lib/cart");
    expect((await readCart()).lines).toHaveLength(1);
    quiet.mockRestore();
  });

  it("lets go of the pieces the failed attempt held, so trying again can have them", async () => {
    const style = await firstStyle();
    const { saveStyleOverride } = await import("@/lib/live-catalog");
    await saveStyleOverride({
      styleId: style.id,
      isPublished: true,
      stock: { s: 1 },
      countedAt: { s: "2026-09-01T12:00:00.000Z" },
    });
    const { createCheckoutSession } = await import("@/lib/payments");
    vi.mocked(createCheckoutSession).mockResolvedValueOnce(null);

    expect((await checkout()).status).toBe(502);
    expect((await checkout()).status).toBe(200);
  });

  it("empties the cart once the payment page exists", async () => {
    const response = await checkout();

    expect(await response.json()).toMatchObject({ checkoutUrl: "https://checkout.stripe.test/session" });
    const { readCart } = await import("@/lib/cart");
    expect((await readCart()).lines).toEqual([]);
  });
});

describe("a cart and the pieces on the rack", () => {
  it("records what the order took, garment by size, so the stock can count it", async () => {
    const response = await checkout();
    const { reference } = (await response.json()) as { reference: string };

    const { findRequest } = await import("@/lib/request-store");
    const style = await firstStyle();
    expect(findRequest(reference)?.pieces).toEqual([
      { styleId: style.id, sizeId: "s", quantity: 1, madeToMeasure: false },
    ]);
  });

  it("refuses a piece that sold out while it sat in the cart, and leaves the cart as it was", async () => {
    const style = await firstStyle();
    const { saveStyleOverride } = await import("@/lib/live-catalog");
    await saveStyleOverride({
      styleId: style.id,
      isPublished: true,
      stock: { s: 0 },
      countedAt: { s: "2026-09-01T12:00:00.000Z" },
    });

    const response = await checkout();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "sold-out" });
    const { readCart } = await import("@/lib/cart");
    expect((await readCart()).lines).toHaveLength(1);
    const { listRequests } = await import("@/lib/request-store");
    expect(listRequests("order")).toEqual([]);
  });

  it("holds the last piece for the first of two checkouts that arrive together", async () => {
    const style = await firstStyle();
    const { saveStyleOverride } = await import("@/lib/live-catalog");
    await saveStyleOverride({
      styleId: style.id,
      isPublished: true,
      stock: { s: 1 },
      countedAt: { s: "2026-09-01T12:00:00.000Z" },
    });

    const statuses = (await Promise.all([checkout(), checkout()])).map((response) => response.status).sort();

    expect(statuses).toEqual([200, 409]);
  });
});
