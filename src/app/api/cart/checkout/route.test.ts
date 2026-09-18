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

async function checkout() {
  const { writeCart } = await import("@/lib/cart");
  const { styles } = await import("@/content");
  const style = styles.find((candidate) => candidate.isPublished)!;
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
