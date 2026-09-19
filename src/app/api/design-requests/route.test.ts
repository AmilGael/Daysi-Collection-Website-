import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A design from the studio reaches Daysi as a picture, and only once its fee
 * is paid: the sketch is stored with the record, the record waits on the
 * payment page like a cart order, and she hears of it when Stripe confirms.
 * The picture is the request, so one that is not an image is refused rather
 * than dropped, and with no way to pay nothing is written at all.
 */

vi.mock("@/lib/auth/session", () => ({ currentViewer: vi.fn(async () => null) }));
vi.mock("@/lib/payments", () => ({
  createCheckoutSession: vi.fn(async () => ({ url: "https://checkout.stripe.test/design" })),
}));

// A real one-pixel PNG: the bytes open with the PNG signature the route checks.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-design-requests-"));
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

async function send(overrides: Record<string, unknown> = {}) {
  const { fabrics } = await import("@/content");
  const { silhouettes } = await import("@/content/silhouettes");
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost:3000/api/design-requests", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        website: "",
        renderedAt: Date.now() - 60_000,
        email: "ana@example.com",
        name: "Ana Pérez",
        phone: "9175550100",
        notes: "Con el cuello más alto.",
        silhouetteId: silhouettes[0]!.id,
        fabricId: fabrics[0]!.id,
        trimColor: "#e8a302",
        printScale: 1.2,
        mockupDataUrl: `data:image/png;base64,${PNG_BASE64}`,
        locale: "es",
        acceptedTerms: true,
        ...overrides,
      }),
    }),
  );
}

describe("sending a design to Daysi", () => {
  it("stores a DSN record awaiting payment with the mockup on disk and returns the checkout url", async () => {
    const response = await send();

    expect(response.status).toBe(200);
    const body = (await response.json()) as { reference: string; checkoutUrl: string; estimate: { dueNow: number } };
    expect(body.reference).toMatch(/^DSN-[A-Z0-9]{8}$/);
    expect(body.checkoutUrl).toBe("https://checkout.stripe.test/design");
    expect(body.estimate.dueNow).toBe(2000);

    const { findRequest } = await import("@/lib/request-store");
    const { fabrics } = await import("@/content");
    const { silhouettes } = await import("@/content/silhouettes");
    const record = findRequest(body.reference)!;
    expect(record).toMatchObject({
      kind: "design",
      awaitingPayment: true,
      status: "new",
      photoFile: `${body.reference}.png`,
      client: { name: "Ana Pérez", email: "ana@example.com", phone: "9175550100", preferredContact: "whatsapp" },
      details: {
        Silhouette: silhouettes[0]!.name.en,
        Cloth: fabrics[0]!.name.en,
        Trim: "#e8a302",
        "Print scale": 1.2,
        Notes: "Con el cuello más alto.",
      },
    });
    expect(record.accountId).toBeTruthy();
    expect(readFileSync(path.join(dir, "photos", `${body.reference}.png`))).toEqual(
      Buffer.from(PNG_BASE64, "base64"),
    );
  });

  it("asks Stripe for the fee alone, card only, closing with the usual half hour", async () => {
    const response = await send();
    const { reference } = (await response.json()) as { reference: string };

    const { createCheckoutSession } = await import("@/lib/payments");
    const { CHECKOUT_HOLD_MINUTES } = await import("@/lib/availability");
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        reference,
        description: "Daysi Collection · Tarifa de diseño",
        customerEmail: "ana@example.com",
        locale: "es",
        cardsOnly: true,
        expiresInMinutes: CHECKOUT_HOLD_MINUTES,
        estimate: expect.objectContaining({ dueNow: 2000, total: 2000 }),
      }),
    );
  });

  it("takes a guest who gives only an email, and replies by email", async () => {
    const response = await send({ name: undefined, phone: undefined });

    expect(response.status).toBe(200);
    const { reference } = (await response.json()) as { reference: string };
    const { findRequest } = await import("@/lib/request-store");
    expect(findRequest(reference)?.client).toMatchObject({ name: "", preferredContact: "email" });
  });

  it("refuses a data URL that is not an image with 400 bad-mockup, and stores nothing", async () => {
    const notAnImage = Buffer.from("<svg onload=alert(1)>").toString("base64");

    const response = await send({ mockupDataUrl: `data:image/png;base64,${notAnImage}` });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bad-mockup" });
    const { listRequests } = await import("@/lib/request-store");
    expect(listRequests("design")).toEqual([]);
    expect(existsSync(path.join(dir, "photos"))).toBe(false);
  });

  it("answers 503 payments-off and writes nothing when Stripe is off", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    const response = await send();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "payments-off" });
    const { listRequests } = await import("@/lib/request-store");
    expect(listRequests("design")).toEqual([]);
    expect(existsSync(path.join(dir, "photos"))).toBe(false);
    const { createCheckoutSession } = await import("@/lib/payments");
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses a fabric the atelier does not offer", async () => {
    const response = await send({ fabricId: "velvet-we-never-had" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unknown-fabric" });
    const { listRequests } = await import("@/lib/request-store");
    expect(listRequests("design")).toEqual([]);
  });

  it("refuses a silhouette the studio does not draw", async () => {
    const response = await send({ silhouetteId: "ball-gown" });

    expect(response.status).toBe(400);
  });

  it("closes the record and answers 502 when Stripe gives no page", async () => {
    const { createCheckoutSession } = await import("@/lib/payments");
    vi.mocked(createCheckoutSession).mockResolvedValueOnce(null);

    const response = await send();

    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string; reference: string };
    expect(body.error).toBe("checkout-unavailable");
    const { findRequest, unfinishedCheckout } = await import("@/lib/request-store");
    const record = findRequest(body.reference)!;
    expect(record.status).toBe("closed");
    expect(unfinishedCheckout(record)).toBe(true);
  });

  it("quietly drops a form filled faster than a person could", async () => {
    const response = await send({ renderedAt: Date.now() });

    expect(response.status).toBe(200);
    const { listRequests } = await import("@/lib/request-store");
    expect(listRequests("design")).toEqual([]);
    const { createCheckoutSession } = await import("@/lib/payments");
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});
