import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The charge route's own decisions: owner only, and each refusal from
 * `chargeRecord` answered with a status the panel can read. What a charge
 * does is tested in `office-charge.test.ts`.
 */

const viewer = vi.hoisted(() => ({ role: "owner" as string | null }));
vi.mock("@/lib/auth/session", () => ({
  currentViewer: vi.fn(async () => (viewer.role ? { role: viewer.role, account: { email: "d@example.com" } } : null)),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const charge = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/office-charge", () => ({ chargeRecord: charge.record }));

beforeEach(() => {
  vi.resetModules();
  viewer.role = "owner";
  charge.record.mockReset();
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});
afterEach(() => vi.unstubAllEnvs());

async function post(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost:3000/api/office/charge", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify(body),
    }),
  );
}

describe("the office charge route", () => {
  it("hands back the link it made", async () => {
    const link = { url: "https://checkout.stripe.test/cs_1", sessionId: "cs_1", amount: 4500, expiresAt: "2026-09-20T12:00:00.000Z" };
    charge.record.mockResolvedValueOnce({ ok: true, link });
    const response = await post({ reference: "ALT-1", amount: 4500 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, link });
    expect(charge.record).toHaveBeenCalledWith("ALT-1", 4500);
  });

  it("refuses anyone but the owner, before Stripe is asked", async () => {
    viewer.role = "client";
    const response = await post({ reference: "ALT-1", amount: 4500 });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(charge.record).not.toHaveBeenCalled();
  });

  it("refuses an amount under a dollar at the door", async () => {
    const response = await post({ reference: "ALT-1", amount: 50 });
    expect(response.status).toBe(400);
    expect(charge.record).not.toHaveBeenCalled();
  });

  it("says 503 with Stripe off and 502 when the old link could not be closed", async () => {
    charge.record.mockResolvedValueOnce({ ok: false, error: "payments-off" });
    expect((await post({ reference: "ALT-1", amount: 4500 })).status).toBe(503);
    charge.record.mockResolvedValueOnce({ ok: false, error: "old-link-open" });
    const response = await post({ reference: "ALT-1", amount: 4500 });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "old-link-open" });
  });
});
