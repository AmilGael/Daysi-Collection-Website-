import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the Prices tab writes when Daysi adds an alteration or a session: a
 * record with a generated id, the words she typed in Spanish, and English
 * beside them (a copy of the Spanish while no translation key is set). What
 * she added she can retire and restore; what the site shipped with she can
 * only reprice.
 */

const state = vi.hoisted(() => ({ requestHeaders: new Headers() }));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => state.requestHeaders) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentViewer: vi.fn(async () => ({ role: "owner" })) }));

let dataDirectory: string;

beforeEach(() => {
  vi.resetModules();
  state.requestHeaders = new Headers({ origin: "https://shop.test", host: "shop.test" });
  dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "daysi-added-services-"));
  process.env.DATA_DIR = dataDirectory;
  // No key, so the English is the Spanish copied and no call leaves the machine.
  vi.stubEnv("ANTHROPIC_API_KEY", "");
});

afterEach(() => {
  fs.rmSync(dataDirectory, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  vi.unstubAllEnvs();
});

async function apply(...changes: Record<string, unknown>[]) {
  const { applyPriceChanges } = await import("@/app/[locale]/office/prices/actions");
  const result = await applyPriceChanges(changes);
  if (!result.ok) throw new Error(result.error);
  return result.results;
}

const alterationAdd = {
  type: "alteration-add",
  key: "alteration-add:one",
  name: "Poner puños",
  description: "Puños nuevos en una manga sencilla.",
  fixedPrice: 3200,
  rushSurcharge: 2000,
  turnaround: "4–6 días",
  photo: "/uploads/cuffs.jpg",
};

const appointmentAdd = {
  type: "appointment-add",
  key: "appointment-add:one",
  name: "Prueba de novia",
  minutes: 45,
  fee: 9000,
  suitedFor: "Una novia a dos semanas de la boda",
};

describe("adding from the Prices tab", () => {
  it("writes an alteration with an alt- id, both languages and its photo", async () => {
    expect(await apply(alterationAdd)).toEqual([{ key: "alteration-add:one", ok: true }]);
    const { liveAlterations } = await import("./live-pricing");
    const added = liveAlterations().at(-1)!;
    expect(added.id).toMatch(/^alt-[a-z0-9]{8}$/);
    expect(added).toMatchObject({
      name: { es: "Poner puños", en: "Poner puños" },
      description: { es: "Puños nuevos en una manga sencilla.", en: "Puños nuevos en una manga sencilla." },
      turnaround: { es: "4–6 días", en: "4–6 días" },
      fixedPrice: 3200,
      rushSurcharge: 2000,
      photo: "/uploads/cuffs.jpg",
    });
  });

  it("writes a session with a ses- id whose deposit is its fee", async () => {
    await apply(appointmentAdd);
    const { liveAppointmentTypes } = await import("./live-pricing");
    const added = liveAppointmentTypes().at(-1)!;
    expect(added.id).toMatch(/^ses-[a-z0-9]{8}$/);
    expect(added).toMatchObject({
      minutes: 45,
      fee: 9000,
      depositDue: 9000,
      name: { es: "Prueba de novia", en: "Prueba de novia" },
      suitedFor: [{ es: "Una novia a dos semanas de la boda", en: "Una novia a dos semanas de la boda" }],
    });
  });

  it("leaves an added session with nothing it is for with an empty list, not an empty line", async () => {
    await apply({ ...appointmentAdd, suitedFor: "" });
    const { liveAppointmentTypes } = await import("./live-pricing");
    expect(liveAppointmentTypes().at(-1)!.suitedFor).toEqual([]);
  });
});

describe("retiring from the Prices tab", () => {
  it("retires and restores an alteration and a session she added", async () => {
    await apply(alterationAdd, appointmentAdd);
    const { liveAlterations, liveAppointmentTypes } = await import("./live-pricing");
    const alteration = liveAlterations().at(-1)!.id;
    const session = liveAppointmentTypes().at(-1)!.id;

    expect(
      await apply(
        { type: "retire", key: `alteration:${alteration}`, id: alteration, kind: "alteration" },
        { type: "retire", key: `appointment:${session}`, id: session, kind: "appointment-type" },
      ),
    ).toEqual([
      { key: `alteration:${alteration}`, ok: true },
      { key: `appointment:${session}`, ok: true },
    ]);
    expect(liveAlterations().some((item) => item.id === alteration)).toBe(false);
    expect(liveAppointmentTypes().some((item) => item.id === session)).toBe(false);

    await apply(
      { type: "restore", key: `alteration:${alteration}`, id: alteration, kind: "alteration" },
      { type: "restore", key: `appointment:${session}`, id: session, kind: "appointment-type" },
    );
    expect(liveAlterations().some((item) => item.id === alteration)).toBe(true);
    expect(liveAppointmentTypes().some((item) => item.id === session)).toBe(true);
  });

  it("refuses to retire what the site shipped with, and an id nobody added", async () => {
    expect(
      await apply(
        { type: "retire", key: "alteration:hem-dress", id: "hem-dress", kind: "alteration" },
        { type: "retire", key: "appointment:consultation-30", id: "consultation-30", kind: "appointment-type" },
        { type: "retire", key: "alteration:alt-nobody", id: "alt-nobody", kind: "alteration" },
        { type: "retire", key: "appointment:ses-nobody", id: "ses-nobody", kind: "appointment-type" },
      ),
    ).toEqual([
      { key: "alteration:hem-dress", ok: false, error: "coded-service" },
      { key: "appointment:consultation-30", ok: false, error: "coded-service" },
      { key: "alteration:alt-nobody", ok: false, error: "unknown-alteration" },
      { key: "appointment:ses-nobody", ok: false, error: "unknown-appointment" },
    ]);
  });

  it("still reads a retire with no kind as a garment price", async () => {
    const { priceList } = await import("@/content");
    const { manageablePriceList } = await import("./live-pricing");
    const unused = priceList.find((entry) => entry.id === "shirts--laguna-wax")!;
    const [result] = await apply({ type: "retire", key: `entry:${unused.id}`, id: unused.id });
    // Either retired, or refused because a garment still uses it: never read as another kind.
    expect(result!.error ?? "retired").toMatch(/^(retired|in-use)$/);
    if (result!.ok) expect(manageablePriceList().find((entry) => entry.id === unused.id)?.retired).toBe(true);
  });

  it("refuses a price edit on a retired alteration, as on one that does not exist", async () => {
    await apply(alterationAdd);
    const { liveAlterations } = await import("./live-pricing");
    const alteration = liveAlterations().at(-1)!.id;
    await apply({ type: "retire", key: `alteration:${alteration}`, id: alteration, kind: "alteration" });
    expect(
      await apply({ type: "alteration", key: `alteration:${alteration}`, id: alteration, fixedPrice: 100, rushSurcharge: 0 }),
    ).toEqual([{ key: `alteration:${alteration}`, ok: false, error: "unknown-alteration" }]);
  });
});
