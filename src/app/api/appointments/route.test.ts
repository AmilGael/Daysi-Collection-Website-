import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A booking names its session by id, and the id is checked against the live
 * list rather than the coded one: a session Daysi added from Precios is
 * bookable, and one she retired, or one nobody ever offered, is refused by
 * name before a slot is looked at.
 */

vi.mock("@/lib/payments", () => ({
  createCheckoutSession: vi.fn(async () => ({ url: "https://checkout.stripe.test/session" })),
}));

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-appointments-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const fitting = {
  id: "ses-fitting",
  minutes: 45,
  name: { es: "Prueba de novia", en: "Bridal fitting" },
  description: { es: "", en: "" },
  fee: 9000,
  depositDue: 9000,
  overtimeRatePerHalfHour: 4000,
  suitedFor: [{ es: "Una novia a dos semanas", en: "A bride two weeks out" }],
};

async function book(appointmentTypeId: string, date = "2030-01-07", startTime = "10:00") {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost:3000/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        website: "",
        renderedAt: Date.now() - 10_000,
        client: { name: "Ana", email: "ana@example.com", locale: "en" },
        appointmentTypeId,
        date,
        startTime,
        purpose: "A fitting for the dress I ordered.",
        acceptedTerms: true,
      }),
    }),
  );
}

describe("booking a session", () => {
  it("refuses a session that is not on the live list", async () => {
    const response = await book("consultation-90");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unknown-appointment" });
  });

  it("refuses a session Daysi added and then retired", async () => {
    const { saveAddedAppointmentType } = await import("@/lib/live-pricing");
    const { setRetired } = await import("@/lib/retired");
    await saveAddedAppointmentType(fitting);
    await setRetired("appointment-type", "ses-fitting", true);

    const response = await book("ses-fitting");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unknown-appointment" });
  });

  it("offers and books a session Daysi added, for its own length and fee", async () => {
    const { saveAddedAppointmentType } = await import("@/lib/live-pricing");
    const { findRequest } = await import("@/lib/request-store");
    await saveAddedAppointmentType(fitting);

    const { GET } = await import("./route");
    const offered = await GET(new Request("http://localhost:3000/api/appointments?type=ses-fitting"));
    expect(offered.status).toBe(200);
    const { days } = (await offered.json()) as { days: { date: string; slots: string[] }[] };
    const day = days[0]!;

    const response = await book("ses-fitting", day.date, day.slots[0]!);
    expect(response.status).toBe(200);
    const { reference, estimate } = (await response.json()) as { reference: string; estimate: { subtotal: number } };
    expect(estimate.subtotal).toBe(9000);
    expect(findRequest(reference)?.details).toMatchObject({ minutes: 45, Session: "Bridal fitting" });
  });
});
