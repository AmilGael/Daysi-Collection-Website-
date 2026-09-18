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
  // No translation service: the office actions copy the Spanish, never call out.
  vi.stubEnv("ANTHROPIC_API_KEY", "");

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

  it("a premiere sign-up for an added premiere is accepted", async () => {
    const { saveAddedPremiere } = await import("./live-premieres");
    const { findRequest } = await import("./request-store");

    await saveAddedPremiere({
      id: "est-a1b2c3d4",
      slug: "una-nueva-temporada",
      season: { es: "Invierno 2027", en: "Winter 2027" },
      title: { es: "Nieve", en: "Snow" },
      story: { es: "Historia", en: "Story" },
      inspiration: { es: "Inspiración", en: "Inspiration" },
      revealDate: "2027-01-05",
      releaseDate: "2027-02-01",
      piecesPlanned: 6,
      editionSize: 12,
      coverImage: "/uploads/nieve.jpg",
      styleIds: [],
      added: true,
      addedAt: new Date().toISOString(),
    });

    const { POST } = await import("@/app/api/premiere-signups/route");
    const response = await POST(
      post("/api/premiere-signups", {
        website: "",
        renderedAt: Date.now() - 10_000,
        email: "ana@example.com",
        name: "Ana",
        locale: "es",
        premiereId: "est-a1b2c3d4",
      }),
    );
    expect(response.status).toBe(200);
    const { reference } = (await response.json()) as { reference: string };
    expect(findRequest(reference)).toMatchObject({
      kind: "premiere-signup",
      details: { Premiere: "Snow", Season: "Winter 2027", PremiereId: "est-a1b2c3d4" },
    });
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

describe("a promotion run from the shop window", () => {
  async function apply(...changes: Record<string, unknown>[]) {
    const { headers } = await import("next/headers");
    vi.mocked(headers).mockResolvedValue(
      new Headers({ origin: "http://localhost:3000", host: "localhost:3000" }),
    );
    const { currentViewer } = await import("@/lib/auth/session");
    vi.mocked(currentViewer).mockResolvedValue({ role: "owner" } as Awaited<ReturnType<typeof currentViewer>>);
    const { applyShopfrontChanges } = await import("@/app/[locale]/office/shopfront/actions");
    const result = await applyShopfrontChanges(changes);
    if (!result.ok) throw new Error(result.error);
    return result.results;
  }

  // 65 % off the $295 Sirena set is $103.25 a piece: under the $110 exemption.
  const onSirena = {
    type: "promotion",
    key: "promotion:new",
    label: "Sirena rebajada",
    kind: "percent",
    value: 65,
    scope: { type: "style", styleId: "sirena" },
    active: true,
  };

  it("lowers that garment in the cart, taxes the lowered piece, and leaves the made-to-measure extra and every other garment alone", async () => {
    expect(await apply(onSirena)).toEqual([{ key: "promotion:new", ok: true }]);

    const { estimateCart, estimateReadyMade } = await import("./pricing");
    const cart = estimateCart([{ styleSlug: "sirena", sizeId: "s", customize: false, quantity: 2 }]);
    expect(cart?.lines[0]).toMatchObject({ amount: 20650, unitAmount: 10325, listAmount: 59000, listUnitAmount: 29500 });
    expect(cart?.salesTax).toBe(0);
    expect(cart?.total).toBe(20650);

    const measured = estimateReadyMade({ styleSlug: "sirena", sizeId: "m", customize: true });
    expect(measured?.lines[0]).toMatchObject({ amount: 10325, listAmount: 29500 });
    expect(measured?.lines[1]?.amount).toBe(9600);
    expect(measured?.lines[1]).not.toHaveProperty("listAmount");

    const frutera = estimateReadyMade({ styleSlug: "frutera", sizeId: "m", customize: false });
    expect(frutera?.lines[0]).not.toHaveProperty("listAmount");

    const { manageablePromotions } = await import("./live-promotions");
    const [saved] = manageablePromotions();
    expect(saved?.id).toMatch(/^prm-[a-z0-9]{8}$/);
    // No translation service here, so the English is the Spanish until she asks.
    expect(saved?.label).toEqual({ es: "Sirena rebajada", en: "Sirena rebajada" });
  });

  it("stops lowering it once retired, and lowers it again once restored", async () => {
    await apply(onSirena);
    const { manageablePromotions } = await import("./live-promotions");
    const id = manageablePromotions()[0]!.id;
    const { estimateCart } = await import("./pricing");
    const sirena = [{ styleSlug: "sirena", sizeId: "s", customize: false, quantity: 1 }];

    expect(await apply({ type: "retire", key: `promotion:${id}`, id })).toEqual([{ key: `promotion:${id}`, ok: true }]);
    expect(estimateCart(sirena)?.lines[0]).not.toHaveProperty("listAmount");
    expect(estimateCart(sirena)?.salesTax).toBeGreaterThan(0);

    await apply({ type: "restore", key: `promotion:${id}`, id });
    expect(estimateCart(sirena)?.lines[0]?.amount).toBe(10325);
  });

  it("refuses a percent past 90, an amount under a dollar, an end before its start, a garment not on the rack, and an id it never saved", async () => {
    const results = await apply(
      { ...onSirena, key: "promotion:a", value: 91 },
      { ...onSirena, key: "promotion:b", kind: "amount", value: 99 },
      { ...onSirena, key: "promotion:c", startsAt: "2026-09-27", endsAt: "2026-09-20" },
      { ...onSirena, key: "promotion:d", scope: { type: "style", styleId: "nobody" } },
      { ...onSirena, key: "promotion:e", id: "prm-a3c4d6e7" },
      { type: "retire", key: "promotion:f", id: "prm-a3c4d6e7" },
    );
    expect(results.map((result) => result.error)).toEqual([
      "bad-value",
      "bad-value",
      "bad-dates",
      "unknown-style",
      "unknown-promotion",
      "unknown-promotion",
    ]);
    const { manageablePromotions } = await import("./live-promotions");
    expect(manageablePromotions()).toEqual([]);
  });

  it("never gives a piece away: −$110 on everything charges a $105 shirt $10.50, and the till sends it to Stripe", async () => {
    await apply({ ...onSirena, scope: { type: "all" }, kind: "amount", value: 11000 });

    const { estimateCart } = await import("./pricing");
    const cart = estimateCart([{ styleSlug: "amapola", sizeId: "s", customize: false, quantity: 1 }]);
    expect(cart?.lines[0]).toMatchObject({ amount: 1050, unitAmount: 1050, listAmount: 10500 });
    expect(cart?.dueNow).toBe(1050);

    // A guest at the till, not Daysi in the office.
    const { currentViewer } = await import("@/lib/auth/session");
    vi.mocked(currentViewer).mockResolvedValue(null);
    const { writeCart } = await import("./cart");
    await writeCart({ lines: [{ styleSlug: "amapola", sizeId: "s", customize: false, quantity: 1 }] });
    const { POST } = await import("@/app/api/cart/checkout/route");
    const { findRequest } = await import("./request-store");
    const { createCheckoutSession } = await import("@/lib/payments");
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
    const { reference, checkoutUrl } = (await response.json()) as { reference: string; checkoutUrl?: string };
    expect(checkoutUrl).toBe("https://checkout.stripe.test/session");
    expect(findRequest(reference)).toMatchObject({ awaitingPayment: true, estimate: { dueNow: 1050 } });
    expect(vi.mocked(createCheckoutSession)).toHaveBeenCalled();
  });

  it("keeps the English it already has when a saved promotion comes back with the same Spanish", async () => {
    const { manageablePromotions, savePromotion } = await import("./live-promotions");
    const saved = {
      id: "prm-a3c4d6e7",
      label: { es: "Venta de otoño", en: "Autumn sale" },
      kind: "percent" as const,
      value: 15,
      scope: { type: "all" as const },
      active: true,
    };
    await savePromotion(saved);
    await savePromotion({ ...saved, label: { es: "Rebaja", en: "Markdown" } });

    // An undo brings back the earlier Spanish; its English comes back with it.
    await apply({ ...onSirena, ...saved, scope: { type: "all" }, label: "Venta de otoño", active: false });
    expect(manageablePromotions()[0]).toMatchObject({ label: { es: "Venta de otoño", en: "Autumn sale" }, active: false });
  });
});

describe("a premiere announced from the office", () => {
  async function apply(...changes: Record<string, unknown>[]) {
    const { headers } = await import("next/headers");
    vi.mocked(headers).mockResolvedValue(
      new Headers({ origin: "http://localhost:3000", host: "localhost:3000" }),
    );
    const { currentViewer } = await import("@/lib/auth/session");
    vi.mocked(currentViewer).mockResolvedValue({ role: "owner" } as Awaited<ReturnType<typeof currentViewer>>);
    const { applyPremiereChanges } = await import("@/app/[locale]/office/premieres/actions");
    const result = await applyPremiereChanges(changes);
    if (!result.ok) throw new Error(result.error);
    return result.results;
  }

  const create = {
    type: "premiere-create",
    key: "premiere-create:new",
    season: "Invierno 2027",
    title: "Nieve",
    story: "Seis piezas alrededor del primer invierno en el Bronx.",
    inspiration: "El frío que nunca conoció en la isla.",
    revealDate: "2027-01-05",
    releaseDate: "2027-02-01",
    piecesPlanned: 6,
    editionSize: 12,
    coverImage: "/uploads/nieve.jpg",
    styleIds: ["sirena"],
  };

  it("announces a season, copies the Spanish (no translation service configured), and slugs it from the title", async () => {
    expect(await apply(create)).toEqual([{ key: "premiere-create:new", ok: true }]);

    const { manageablePremieres } = await import("./live-premieres");
    // Newest first: this season releases after both seeded ones.
    const [saved] = manageablePremieres();
    expect(saved).toMatchObject({
      slug: "nieve",
      title: { es: "Nieve", en: "Nieve" },
      season: { es: "Invierno 2027", en: "Invierno 2027" },
      piecesPlanned: 6,
      editionSize: 12,
      styleIds: ["sirena"],
      added: true,
      retired: false,
    });
    expect(saved?.id).toMatch(/^est-[a-z0-9]{8}$/);
  });

  it("de-duplicates a slug that collides with an existing one", async () => {
    await apply(create);
    await apply({ ...create, key: "premiere-create:two" });
    const { manageablePremieres } = await import("./live-premieres");
    const slugs = manageablePremieres().map((premiere) => premiere.slug);
    expect(slugs).toEqual(expect.arrayContaining(["nieve", "nieve-2"]));
  });

  it("refuses a release before the reveal, and a garment not on the rack or retired", async () => {
    const { setRetired } = await import("./retired");
    await setRetired("style", "frutera", true);
    const results = await apply(
      { ...create, key: "premiere-create:a", releaseDate: "2027-01-01" },
      { ...create, key: "premiere-create:b", styleIds: ["nobody"] },
      { ...create, key: "premiere-create:c", styleIds: ["frutera"] },
    );
    expect(results.map((result) => result.error)).toEqual(["bad-dates", "unknown-style", "unknown-style"]);
  });

  it("updates only the fields she changed, and leaves the rest", async () => {
    await apply(create);
    const { manageablePremieres } = await import("./live-premieres");
    const id = manageablePremieres()[0]!.id;

    await apply({ type: "premiere-update", key: `premiere:${id}`, premiereId: id, piecesPlanned: 5 });
    const updated = manageablePremieres().find((premiere) => premiere.id === id);
    expect(updated).toMatchObject({ piecesPlanned: 5, title: { es: "Nieve", en: "Nieve" } });
  });

  it("refuses an update to a premiere that does not exist, and one whose new dates cross", async () => {
    const results = await apply(
      { type: "premiere-update", key: "premiere:nobody", premiereId: "nobody", piecesPlanned: 5 },
      { type: "premiere-update", key: "premiere:otono-2026", premiereId: "otono-2026", releaseDate: "2026-09-01" },
    );
    expect(results.map((result) => result.error)).toEqual(["unknown-premiere", "bad-dates"]);
  });

  it("saves which garments belong to the season, and refuses one that is not live", async () => {
    await apply({
      type: "premiere-styles",
      key: "premiere-styles:otono-2026",
      premiereId: "otono-2026",
      styleIds: ["frutera"],
    });
    const { manageablePremieres } = await import("./live-premieres");
    expect(manageablePremieres().find((premiere) => premiere.id === "otono-2026")?.styleIds).toEqual(["frutera"]);

    const refused = await apply({
      type: "premiere-styles",
      key: "premiere-styles:otono-2026",
      premiereId: "otono-2026",
      styleIds: ["nobody"],
    });
    expect(refused[0]?.error).toBe("unknown-style");
  });

  it("retires and restores a season", async () => {
    await apply({ type: "retire", key: "premiere:otono-2026", id: "otono-2026" });
    const { manageablePremieres } = await import("./live-premieres");
    expect(manageablePremieres().find((premiere) => premiere.id === "otono-2026")?.retired).toBe(true);

    await apply({ type: "restore", key: "premiere:otono-2026", id: "otono-2026" });
    expect(manageablePremieres().find((premiere) => premiere.id === "otono-2026")?.retired).toBe(false);
  });

  it("keeps every earlier correction: a pieces edit, then a checklist save, then a title edit all survive together", async () => {
    await apply({ type: "premiere-update", key: "premiere:otono-2026", premiereId: "otono-2026", piecesPlanned: 5 });
    await apply({
      type: "premiere-styles",
      key: "premiere-styles:otono-2026",
      premiereId: "otono-2026",
      styleIds: ["frutera"],
    });
    const { livePremieres } = await import("./live-premieres");
    // The checklist save alone must not have put pieces back to the seed's 6.
    expect(livePremieres().find((premiere) => premiere.id === "otono-2026")).toMatchObject({
      piecesPlanned: 5,
      styleIds: ["frutera"],
    });

    await apply({
      type: "premiere-update",
      key: "premiere:otono-2026",
      premiereId: "otono-2026",
      title: "Yurumein, corregido",
    });
    expect(livePremieres().find((premiere) => premiere.id === "otono-2026")).toMatchObject({
      piecesPlanned: 5,
      styleIds: ["frutera"],
      title: { es: "Yurumein, corregido", en: "Yurumein, corregido" },
    });
  });

  it("keeps the current English when the Spanish sent back is unchanged (an undo, most often), and only translates what actually changed", async () => {
    const { manageablePremieres } = await import("./live-premieres");
    const seeded = manageablePremieres().find((premiere) => premiere.id === "otono-2026")!;

    // An unrelated edit first, so there is an override for the season to
    // undo against, then a change sending the season back exactly as it
    // already reads — the shape an undo to the seeded words takes.
    await apply({ type: "premiere-update", key: "premiere:otono-2026", premiereId: "otono-2026", piecesPlanned: 5 });
    await apply({
      type: "premiere-update",
      key: "premiere:otono-2026",
      premiereId: "otono-2026",
      season: seeded.season.es,
    });

    const after = manageablePremieres().find((premiere) => premiere.id === "otono-2026");
    // Not { es: seeded.season.es, en: seeded.season.es } — the English a
    // no-op translation call would have copied the Spanish into.
    expect(after?.season).toEqual(seeded.season);
  });

  it("accepts an undo that restores the seeded cover, not only an upload path", async () => {
    const { manageablePremieres } = await import("./live-premieres");
    const seeded = manageablePremieres().find((premiere) => premiere.id === "otono-2026")!;

    await apply({
      type: "premiere-update",
      key: "premiere:otono-2026",
      premiereId: "otono-2026",
      coverImage: "/uploads/new-cover.jpg",
    });
    expect(manageablePremieres().find((premiere) => premiere.id === "otono-2026")?.coverImage).toBe(
      "/uploads/new-cover.jpg",
    );

    // The undo sends the season's own seeded cover back: a coded
    // /images/real/… path, not an upload.
    await apply({
      type: "premiere-update",
      key: "premiere:otono-2026",
      premiereId: "otono-2026",
      coverImage: seeded.coverImage,
    });
    expect(manageablePremieres().find((premiere) => premiere.id === "otono-2026")?.coverImage).toBe(
      seeded.coverImage,
    );
  });
});
