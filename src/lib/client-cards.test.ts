import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A client's own card: their save never overwrites a measurement Daysi took,
 * a card Daysi already started is adopted rather than doubled, and clearing
 * the card actually erases what the client entered rather than layering a
 * blank line on top of it.
 */

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "cards-"));
  process.env.DATA_DIR = dir;
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const account = { id: "acc_1", email: "Ana@Example.com ", name: "Ana", locale: "es" as const, createdAt: "2026-09-01T00:00:00Z" };
const now = new Date("2026-09-19T15:00:00Z");

describe("a client's own card", () => {
  it("is created on first save, pinned to the account and its email", async () => {
    const { saveClientCard, cardForAccount } = await import("./client-cards");
    const card = await saveClientCard(account, { name: "Ana Díaz", phone: "718 555 0101", measurements: { waist: { value: 30, unit: "in" } } }, now);
    expect(card.id).toMatch(/^cli_/);
    expect(card.accountId).toBe("acc_1");
    expect(card.email).toBe("ana@example.com");
    expect(card.measurements.waist).toEqual({ value: 30, unit: "in", by: "client", at: now.toISOString() });
    expect(cardForAccount(account)?.id).toBe(card.id);
  });

  it("adopts a card Daysi made for the same email instead of making a second", async () => {
    const { saveClientCard, listClientCards, CLIENT_CARDS } = await import("./client-cards");
    const { appendRecord } = await import("./records");
    await appendRecord(CLIENT_CARDS, { id: "cli_daysi", name: "Ana", email: "ana@example.com", measurements: {}, updatedAt: "2026-09-10T00:00:00Z", updatedBy: "office" });
    const card = await saveClientCard(account, { name: "Ana", measurements: {} }, now);
    expect(card.id).toBe("cli_daysi");
    expect(card.accountId).toBe("acc_1");
    expect(listClientCards()).toHaveLength(1);
  });

  it("never lets a client overwrite a measurement Daysi took", async () => {
    const { saveClientCard, CLIENT_CARDS } = await import("./client-cards");
    const { appendRecord } = await import("./records");
    const daysi = { value: 81, unit: "cm", by: "daysi", at: "2026-09-12T00:00:00Z" };
    await appendRecord(CLIENT_CARDS, { id: "cli_a", accountId: "acc_1", name: "Ana", email: "ana@example.com", measurements: { waist: daysi }, updatedAt: "2026-09-12T00:00:00Z", updatedBy: "office" });
    const card = await saveClientCard(account, { name: "Ana", measurements: { waist: { value: 20, unit: "in" }, hips: { value: 40, unit: "in" } } }, now);
    expect(card.measurements.waist).toEqual(daysi);
    expect(card.measurements.hips?.by).toBe("client");
  });

  it("keeps the original date on a measurement the client did not change", async () => {
    const { saveClientCard } = await import("./client-cards");
    const first = await saveClientCard(account, { name: "Ana", measurements: { hips: { value: 40, unit: "in" } } }, new Date("2026-09-01T00:00:00Z"));
    const second = await saveClientCard(account, { name: "Ana B", measurements: { hips: { value: 40, unit: "in" } } }, now);
    expect(second.measurements.hips?.at).toBe(first.measurements.hips?.at);
  });

  it("keeps Daysi's private note and archive mark through a client save", async () => {
    const { saveClientCard, CLIENT_CARDS } = await import("./client-cards");
    const { appendRecord } = await import("./records");
    await appendRecord(CLIENT_CARDS, { id: "cli_a", accountId: "acc_1", name: "Ana", email: "ana@example.com", measurements: {}, ownerNote: "paga en efectivo", archived: true, updatedAt: "2026-09-12T00:00:00Z", updatedBy: "office" });
    const card = await saveClientCard(account, { name: "Ana", measurements: {} }, now);
    expect(card.ownerNote).toBe("paga en efectivo");
    expect(card.archived).toBe(true);
  });

  it("erases what the client entered from the file itself, keeping Daysi's numbers", async () => {
    const { saveClientCard, clearClientEntries, CLIENT_CARDS } = await import("./client-cards");
    const { appendRecord } = await import("./records");
    const daysi = { value: 81, unit: "cm", by: "daysi", at: "2026-09-12T00:00:00Z" };
    await appendRecord(CLIENT_CARDS, { id: "cli_a", accountId: "acc_1", name: "Ana", email: "ana@example.com", measurements: { waist: daysi }, updatedAt: "2026-09-12T00:00:00Z", updatedBy: "office" });
    await saveClientCard(account, { name: "Ana", address: { line1: "1 Grand Concourse", city: "Bronx", state: "NY", zip: "10451" }, notes: "hombro", measurements: { hips: { value: 40, unit: "in" } } }, now);
    const cleared = await clearClientEntries(account, now);
    expect(cleared?.address).toBeUndefined();
    expect(cleared?.notes).toBeUndefined();
    expect(cleared?.measurements).toEqual({ waist: daysi });
    const file = readFileSync(path.join(dir, `${CLIENT_CARDS}.jsonl`), "utf8");
    expect(file).not.toContain("Grand Concourse");
    expect(file.trim().split("\n")).toHaveLength(1);
  });

  it("counts filled measurements and offers what it knows to the forms", async () => {
    const { saveClientCard, measuredCount, knownContact } = await import("./client-cards");
    expect(knownContact(account)).toEqual({ name: "Ana", email: "ana@example.com", phone: "" });
    const card = await saveClientCard(account, { name: "Ana Díaz", phone: "718 555 0101", measurements: { waist: { value: 30, unit: "in" }, hips: { value: 40, unit: "in" } } }, now);
    expect(measuredCount(card)).toBe(2);
    expect(measuredCount(undefined)).toBe(0);
    expect(knownContact(account)).toEqual({ name: "Ana Díaz", email: "ana@example.com", phone: "718 555 0101" });
  });

  it("reduces a phone to its digits, dropping a US country code", async () => {
    const { phoneDigits } = await import("./client-cards");
    expect(phoneDigits("+1 (718) 555-0101")).toBe("7185550101");
    expect(phoneDigits("718.555.0101")).toBe("7185550101");
  });
});

describe("the client card schema", () => {
  it("accepts a partial card and refuses a measurement out of range", async () => {
    const { clientCardSchema } = await import("./validation");
    expect(clientCardSchema.safeParse({ name: "Ana", measurements: {} }).success).toBe(true);
    expect(clientCardSchema.safeParse({ name: "Ana", measurements: { waist: { value: 320, unit: "in" } } }).success).toBe(false);
    expect(clientCardSchema.safeParse({ name: "Ana", measurements: { elbow: { value: 3, unit: "in" } } }).success).toBe(false);
    expect(clientCardSchema.safeParse({ name: "A", measurements: {} }).success).toBe(false);
  });
});

describe("Daysi's side of a card", () => {
  it("adds a walk-in and locks the numbers she takes", async () => {
    const { officeSaveCard } = await import("./client-cards");
    const card = await officeSaveCard({ type: "client-save", key: "client:new-1", name: "Rosa", phone: "718 555 0101", measurements: { waist: { value: 80, unit: "cm" } } }, now);
    expect(card.updatedBy).toBe("office");
    expect(card.measurements.waist).toEqual({ value: 80, unit: "cm", by: "daysi", at: now.toISOString() });
  });

  it("leaves a client's unchanged measurement as the client's", async () => {
    const { saveClientCard, officeSaveCard } = await import("./client-cards");
    const mine = await saveClientCard(account, { name: "Ana", measurements: { hips: { value: 40, unit: "in" } } }, new Date("2026-09-01T00:00:00Z"));
    const card = await officeSaveCard({ type: "client-save", key: `client:${mine.id}`, cardId: mine.id, name: "Ana", email: "ana@example.com", ownerNote: "cliente de años", measurements: { hips: { value: 40, unit: "in" } } }, now);
    expect(card.measurements.hips?.by).toBe("client");
    expect(card.ownerNote).toBe("cliente de años");
    expect(card.accountId).toBe("acc_1");
  });

  it("refuses an email another card has, and a new email on an account's card", async () => {
    const { saveClientCard, officeSaveCard } = await import("./client-cards");
    const mine = await saveClientCard(account, { name: "Ana", measurements: {} }, now);
    await expect(officeSaveCard({ type: "client-save", key: "client:new-2", name: "Otra", email: "ANA@example.com", measurements: {} }, now)).rejects.toMatchObject({ code: "taken" });
    await expect(officeSaveCard({ type: "client-save", key: `client:${mine.id}`, cardId: mine.id, name: "Ana", email: "otra@example.com", measurements: {} }, now)).rejects.toMatchObject({ code: "locked-email" });
  });

  it("removes a measurement, the address or a note when she sends null", async () => {
    const { officeSaveCard } = await import("./client-cards");
    const card = await officeSaveCard({ type: "client-save", key: "client:new-3", name: "Rosa", notes: "x", address: { line1: "1 Main St", city: "Bronx", state: "NY", zip: "10451" }, measurements: { waist: { value: 80, unit: "cm" } } }, now);
    const after = await officeSaveCard({ type: "client-save", key: `client:${card.id}`, cardId: card.id, name: "Rosa", notes: null, address: null, measurements: { waist: null } }, now);
    expect(after.notes).toBeUndefined();
    expect(after.address).toBeUndefined();
    expect(after.measurements.waist).toBeUndefined();
  });

  it("archives and restores, and a revert brings back a version exactly", async () => {
    const { officeSaveCard, officeArchiveCard, officeRevertCard, findClientCard } = await import("./client-cards");
    const first = await officeSaveCard({ type: "client-save", key: "client:new-4", name: "Rosa", measurements: {} }, new Date("2026-09-10T00:00:00Z"));
    await officeArchiveCard(first.id, true, new Date("2026-09-11T00:00:00Z"));
    expect(findClientCard(first.id)?.archived).toBe(true);
    await officeRevertCard(first.id, first.updatedAt, now);
    expect(findClientCard(first.id)?.archived).toBeUndefined();
    expect(findClientCard(first.id)).toMatchObject({ name: "Rosa", updatedAt: now.toISOString() });
  });
});

describe("the office change schema for clients", () => {
  it("accepts the three wires and refuses a bad measurement", async () => {
    const { clientChangeSchema } = await import("./office-validation");
    expect(clientChangeSchema.safeParse({ type: "client-save", key: "client:new-1", name: "Rosa", measurements: { waist: { value: 80, unit: "cm" }, hips: null } }).success).toBe(true);
    expect(clientChangeSchema.safeParse({ type: "client-archive", key: "client:cli_a", id: "cli_a", archived: true }).success).toBe(true);
    expect(clientChangeSchema.safeParse({ type: "client-revert", key: "client:cli_a", id: "cli_a", to: "2026-09-10T00:00:00.000Z" }).success).toBe(true);
    expect(clientChangeSchema.safeParse({ type: "client-save", key: "client:new-1", name: "Rosa", measurements: { waist: { value: 900, unit: "cm" } } }).success).toBe(false);
  });
});
