import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { GarmentStyle, PriceListEntry } from "@/content/types";

/**
 * Every reader that names or prices a garment goes through the live catalog:
 * the coded styles with Daysi's corrections, additions and retirements on top.
 * Before this, a garment she added from the office could be browsed but never
 * ordered, and a name she corrected was still wrong in the cart line, the
 * request email, the premiere list and the browser tab.
 */

// The cart checkout reads its cart from a cookie, its viewer from the session,
// and hands the payment to Stripe; none of those is what these tests are about.
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
// Only the office action tests below reach `ownerAction`, which revalidates
// paths outside a request's render lifecycle; nothing here checks the call.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let dir: string;

const SOL: GarmentStyle = {
  id: "sol",
  slug: "sol",
  name: { en: "Sol dress", es: "Vestido Sol" },
  categoryId: "heritage",
  priceEntryId: "heritage--sol-linen",
  color: { en: "Yellow", es: "Amarillo" },
  description: { en: "Added from the office.", es: "Agregado desde la oficina." },
  detail: { en: "", es: "" },
  sizes: [{ sizeId: "s", inStock: true }],
  photos: [],
  customizationAvailable: false,
  isPublished: true,
};

const SOL_PRICE: PriceListEntry = {
  id: "heritage--sol-linen",
  categoryId: "heritage",
  fabricId: "linen",
  fixedPrice: 12000,
  customizationExtra: 0,
  customizationNote: { en: "", es: "" },
  effectiveDate: "2026-09-07",
};

beforeEach(async () => {
  vi.resetModules();
  jar.clear();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-live-readers-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  // Read once, when `env` first loads: the cart checkout refuses outright without it.
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");

  const { saveAddedStyle } = await import("./live-catalog");
  const { saveCustomEntry } = await import("./live-pricing");
  const { saveTextOverride } = await import("./live-text");
  await saveAddedStyle(SOL);
  await saveCustomEntry(SOL_PRICE);
  await saveTextOverride({ subject: "style", id: "sol", field: "name", locale: "en", value: "Sol dress, corrected" });
  await saveTextOverride({ subject: "style", id: "frutera", field: "name", locale: "en", value: "Frutera, corrected" });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("pricing an added garment", () => {
  it("prices a garment Daysi added, under its corrected name", async () => {
    const { estimateReadyMade } = await import("./pricing");
    const estimate = estimateReadyMade({ styleSlug: "sol", sizeId: "s", customize: false });
    expect(estimate?.subtotal).toBe(12000);
    expect(estimate?.lines[0]?.label.en).toBe("Sol dress, corrected");
  });

  it("prices a cart holding a garment Daysi added", async () => {
    const { estimateCart } = await import("./pricing");
    const estimate = estimateCart([{ styleSlug: "sol", sizeId: "s", customize: false, quantity: 2 }]);
    expect(estimate?.subtotal).toBe(24000);
    expect(estimate?.lines[0]?.label.en).toBe("Sol dress, corrected");
  });

  it("charges a garment's own price in an estimate and a cart once Daysi sets one", async () => {
    const { saveStyleOverride } = await import("./live-catalog");
    const { estimateCart, estimateReadyMade } = await import("./pricing");
    await saveStyleOverride({ styleId: "sol", isPublished: true, stock: {}, fixedPrice: 9900 });

    expect(estimateReadyMade({ styleSlug: "sol", sizeId: "s", customize: false })?.subtotal).toBe(9900);
    const cart = estimateCart([{ styleSlug: "sol", sizeId: "s", customize: false, quantity: 2 }]);
    expect(cart?.subtotal).toBe(19800);
    expect(cart?.lines[0]?.unitAmount).toBe(9900);
    // Under $110 a piece, so the clothing exemption follows the own price too.
    expect(cart?.salesTax).toBe(0);
  });

  it("charges the garment's own extra when set, else the entry's", async () => {
    const { saveStyleOverride } = await import("./live-catalog");
    const { estimateCart, estimateReadyMade } = await import("./pricing");
    const { styles, priceList } = await import("@/content");
    const frutera = styles.find((style) => style.id === "frutera")!;
    const listed = priceList.find((entry) => entry.id === frutera.priceEntryId)!;

    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: {}, fixedPrice: 20000 });
    const listExtra = estimateReadyMade({ styleSlug: "frutera", sizeId: "m", customize: true });
    expect(listExtra?.lines.map((line) => line.amount)).toEqual([20000, listed.customizationExtra]);

    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: {}, fixedPrice: 20000, customizationExtra: 5000 });
    const ownExtra = estimateCart([{ styleSlug: "frutera", sizeId: "m", customize: true, quantity: 1 }]);
    expect(ownExtra?.lines.map((line) => line.amount)).toEqual([20000, 5000]);
    expect(ownExtra?.lines[1]?.note).toEqual(listed.customizationNote);

    // A newer line without a price is the list price again.
    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: {} });
    expect(estimateReadyMade({ styleSlug: "frutera", sizeId: "m", customize: false })?.subtotal).toBe(listed.fixedPrice);
  });

  it("refuses a garment that is not in the live catalog", async () => {
    const { estimateReadyMade } = await import("./pricing");
    expect(estimateReadyMade({ styleSlug: "nobody", sizeId: "s", customize: false })).toBeNull();
  });
});

const client = { name: "Ana", email: "ana@example.com", phone: "9175550100", preferredContact: "email", locale: "en" };

async function POST_requests(request: Request): Promise<Response> {
  const { POST } = await import("@/app/api/requests/route");
  return POST(request);
}

function post(url: string, body: unknown): Request {
  return new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
    body: JSON.stringify(body),
  });
}

describe("the request form", () => {
  it("records a commission, priced from the published list", async () => {
    const { POST } = await import("@/app/api/requests/route");
    const { findRequest } = await import("./request-store");
    const response = await POST(
      post("/api/requests", {
        kind: "commission",
        website: "",
        renderedAt: Date.now() - 10_000,
        client,
        categoryId: "heritage",
        fabricId: "wax-print",
        customize: true,
        occasion: "A wedding",
        neededBy: "2026-11-01",
        notes: "",
        acceptedTerms: true,
      }),
    );
    expect(response.status).toBe(200);
    const { reference } = (await response.json()) as { reference: string };
    expect(findRequest(reference)).toMatchObject({ kind: "commission", details: { Garment: "heritage" } });
    expect(findRequest(reference)?.estimate?.subtotal).toBeGreaterThan(0);
  });

  it("takes an alteration request from a guest who gave only an email", async () => {
    const { POST } = await import("@/app/api/requests/route");
    const { findRequest } = await import("./request-store");
    const response = await POST(
      post("/api/requests", {
        kind: "alteration",
        website: "",
        renderedAt: Date.now() - 10_000,
        client: { email: "guest@example.com", locale: "en" },
        garmentDescription: "A navy wool jacket that runs a little wide through the body.",
        alterationIds: ["hem-dress"],
        rush: false,
        preferredTiming: "Before the 20th",
        notes: "",
        acceptedTerms: true,
      }),
    );
    expect(response.status).toBe(200);
    const { reference } = (await response.json()) as { reference: string };
    expect(findRequest(reference)?.client).toMatchObject({ name: "", email: "guest@example.com" });
  });

  it("refuses to reply by phone when the guest left no number to call", async () => {
    const { POST } = await import("@/app/api/requests/route");
    const response = await POST(
      post("/api/requests", {
        kind: "alteration",
        website: "",
        renderedAt: Date.now() - 10_000,
        client: { email: "guest@example.com", locale: "en", preferredContact: "phone" },
        garmentDescription: "A navy wool jacket that runs a little wide through the body.",
        alterationIds: ["hem-dress"],
        rush: false,
        preferredTiming: "Before the 20th",
        notes: "",
        acceptedTerms: true,
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "phone-required" });
  });

  const alterationRequest = (alterationIds: string[]) =>
    post("/api/requests", {
      kind: "alteration",
      website: "",
      renderedAt: Date.now() - 10_000,
      client,
      garmentDescription: "A linen shirt whose cuffs have frayed through at the edge.",
      alterationIds,
      rush: true,
      preferredTiming: "Next week",
      notes: "",
      acceptedTerms: true,
    });
  const cuffs = {
    id: "alt-cuffs",
    name: { es: "Poner puños nuevos", en: "Put on new cuffs" },
    description: { es: "Puños nuevos en una manga sencilla.", en: "New cuffs on a plain sleeve." },
    fixedPrice: 3200,
    rushSurcharge: 2400,
    turnaround: { es: "4–6 días", en: "4–6 days" },
  };

  it("prices an alteration Daysi added, and names it in the request she reads", async () => {
    const { saveAddedAlteration } = await import("./live-pricing");
    const { findRequest } = await import("./request-store");
    await saveAddedAlteration(cuffs);
    const response = await POST_requests(alterationRequest(["alt-cuffs", "hem-pants"]));
    expect(response.status).toBe(200);
    const { reference, estimate } = (await response.json()) as { reference: string; estimate: { subtotal: number } };
    expect(estimate.subtotal).toBe(3200 + 2400 + 2000 + 2000);
    expect(findRequest(reference)?.details.Work).toEqual(["Put on new cuffs", "Hem pants"]);
  });

  it("refuses an alteration that is not on the live list, or that Daysi retired", async () => {
    const { saveAddedAlteration } = await import("./live-pricing");
    const { setRetired } = await import("./retired");
    const { listRequests } = await import("./request-store");

    const unknown = await POST_requests(alterationRequest(["hem-dress", "gold-plating"]));
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({ error: "unknown-alteration" });

    await saveAddedAlteration(cuffs);
    await setRetired("alteration", "alt-cuffs", true);
    const retired = await POST_requests(alterationRequest(["alt-cuffs"]));
    expect(retired.status).toBe(400);
    expect(await retired.json()).toEqual({ error: "unknown-alteration" });
    expect(listRequests("alteration")).toEqual([]);
  });

  it("takes no garment from the collection: that is bought through the cart", async () => {
    const { POST } = await import("@/app/api/requests/route");
    const { listRequests } = await import("./request-store");
    const response = await POST(
      post("/api/requests", {
        kind: "order",
        website: "",
        renderedAt: Date.now() - 10_000,
        client,
        styleSlug: "sol",
        sizeId: "s",
        customize: false,
        notes: "",
        acceptedTerms: true,
      }),
    );
    expect(response.status).toBe(400);
    expect(listRequests("order")).toEqual([]);
  });
});

describe("the cart checkout", () => {
  it("writes the corrected name of a garment Daysi added into the order she reads", async () => {
    const { writeCart } = await import("./cart");
    await writeCart({ lines: [{ styleSlug: "sol", sizeId: "s", customize: false, quantity: 1 }] });

    const { POST } = await import("@/app/api/cart/checkout/route");
    const { findRequest } = await import("./request-store");
    const response = await POST(
      post("/api/cart/checkout", {
        name: client.name,
        email: client.email,
        phone: client.phone,
        preferredContact: client.preferredContact,
        locale: client.locale,
        notes: "",
        acceptedTerms: true,
      }),
    );
    expect(response.status).toBe(200);
    const { reference } = (await response.json()) as { reference: string };
    expect(findRequest(reference)?.details.Pieces).toEqual(["Sol dress, corrected · S × 1"]);
  });
});

describe("the premiere list", () => {
  it("shows a premiere's garments with their corrected names", async () => {
    const { liveStylesInPremiere } = await import("./live-catalog");
    const { premieres } = await import("@/content");
    const premiere = premieres.find((candidate) => candidate.styleIds.includes("frutera"))!;
    const names = liveStylesInPremiere(premiere).map((style) => style.name.en);
    expect(names).toContain("Frutera, corrected");
  });
});

describe("noting an order the office took off-site", () => {
  async function apply(change: Record<string, unknown>) {
    const { headers } = await import("next/headers");
    vi.mocked(headers).mockResolvedValue(
      new Headers({ origin: "http://localhost:3000", host: "localhost:3000" }),
    );
    const { currentViewer } = await import("@/lib/auth/session");
    vi.mocked(currentViewer).mockResolvedValue({ role: "owner" } as Awaited<ReturnType<typeof currentViewer>>);
    const { applyWorkChanges } = await import("@/app/[locale]/office/work/actions");
    const result = await applyWorkChanges([change]);
    if (!result.ok) throw new Error(result.error);
    return result.results;
  }

  it("writes a paid $200 order at exactly that total, untaxed, the Hub's ledger and the books both read back", async () => {
    // Well over the $110 clothing exemption, to prove this is never re-taxed:
    // she already collected whatever tax applied, or did not, off-site.
    await apply({
      type: "order-note",
      key: "order-note:one",
      kind: "order",
      clientName: "Rosa Martínez",
      email: "rosa@example.com",
      description: "Vestido azul, talla M",
      amount: 20000,
      paid: true,
    });

    const { loadLedger, monthlyReceived, earningsFrom } = await import("./earnings");
    const ledger = loadLedger();
    const written = ledger.find((record) => record.client.name === "Rosa Martínez");
    expect(written).toMatchObject({
      kind: "order",
      source: "office",
      status: "paid",
      paidVia: "office",
      client: { name: "Rosa Martínez", email: "rosa@example.com" },
    });
    expect(written?.reference).toMatch(/^ORD-/);
    expect(written?.estimate?.salesTax).toBe(0);
    expect(written?.estimate?.total).toBe(20000);
    expect(written?.paidAt).toBeTruthy();

    expect(earningsFrom(ledger).received).toBe(20000);

    // Paid the moment she noted it, so this month's trend already carries it.
    const months = monthlyReceived(ledger, 1, new Date());
    expect(months[0]?.total).toBe(20000);

    const { salesRows } = await import("./books");
    const rows = salesRows([written!], "es");
    expect(rows[0]?.[1]).toBe("Rosa Martínez");
    expect(rows[0]?.[6]).toBe("Anotado en el taller · total recibido");
    expect(rows[0]?.[8]).toBe("200.00");
    expect(rows[0]?.[10]).toBe("NON");
    expect(rows[0]?.[11]).toBe("order");
  });

  it("counts an unpaid note as outstanding, not received, with its own ALT- reference", async () => {
    await apply({
      type: "order-note",
      key: "order-note:two",
      kind: "alteration",
      clientName: "Cliente sin pagar",
      description: "Bastilla de pantalón",
      amount: 3200,
      paid: false,
    });

    const { loadLedger, earningsFrom } = await import("./earnings");
    const ledger = loadLedger();
    const written = ledger.find((record) => record.client.name === "Cliente sin pagar")!;
    expect(written.reference).toMatch(/^ALT-/);
    expect(written.status).toBe("new");
    expect(written.paidAt).toBeUndefined();
    // No email given, so the record cannot silently attach to someone else's account.
    expect(written.client.email).toBe("");

    const earnings = earningsFrom(ledger);
    expect(earnings.outstanding).toBe(3200);
    expect(earnings.received).toBe(0);
  });

  it("keeps a WhatsApp phone on a custom piece, under its own CUS- reference", async () => {
    await apply({
      type: "order-note",
      key: "order-note:cus",
      kind: "commission",
      clientName: "Marta Ríos",
      phone: "\u200E917\u2011555\u20110100",
      description: "Traje a medida, tela propia",
      amount: 45000,
      paid: true,
    });

    const { loadLedger } = await import("./earnings");
    const written = loadLedger().find((record) => record.client.name === "Marta Ríos")!;
    expect(written.reference).toMatch(/^CUS-/);
    expect(written.client.phone).toBe("917-555-0100");
  });

  it("dates a noted order the day she gives it, not the day she typed it, and that is the month it is received in", async () => {
    await apply({
      type: "order-note",
      key: "order-note:dated",
      kind: "commission",
      clientName: "Elena Cruz",
      description: "Vestido de quince",
      amount: 45000,
      paid: true,
      date: "2026-08-20",
    });

    const { loadLedger, monthlyReceived } = await import("./earnings");
    const ledger = loadLedger();
    const written = ledger.find((record) => record.client.name === "Elena Cruz")!;
    expect(written.submittedAt.slice(0, 10)).toBe("2026-08-20");
    expect(written.paidAt?.slice(0, 10)).toBe("2026-08-20");

    const months = monthlyReceived(ledger, 6, new Date("2026-09-18T12:00:00.000Z"));
    expect(months.find((month) => month.month === "2026-08")?.total).toBe(45000);
    expect(months.find((month) => month.month === "2026-09")?.total).toBe(0);
  });

  it("stamps paidAt only when Daysi marks a noted order paid, and that is the month it counts in", async () => {
    await apply({
      type: "order-note",
      key: "order-note:later-paid",
      kind: "alteration",
      clientName: "Nina Ortiz",
      description: "Ajuste de cintura",
      amount: 5000,
      paid: false,
    });
    const { loadLedger } = await import("./earnings");
    const noted = loadLedger().find((record) => record.client.name === "Nina Ortiz")!;
    expect(noted.paidAt).toBeUndefined();

    await apply({
      type: "request-status",
      key: `request:${noted.reference}`,
      kind: noted.kind,
      reference: noted.reference,
      status: "paid",
    });

    const { loadLedger: reload, monthlyReceived } = await import("./earnings");
    const ledger = reload();
    const paidRecord = ledger.find((record) => record.reference === noted.reference)!;
    expect(paidRecord.paidAt).toBeTruthy();

    const months = monthlyReceived(ledger, 1, new Date());
    expect(months[0]?.total).toBe(5000);
  });
});
