import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoredRequest } from "./request-store";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-availability-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("retired appointment availability", () => {
  it("frees a retired appointment slot and takes it again when restored", async () => {
    const { availableDays } = await import("./availability");
    const { saveRequest } = await import("./request-store");
    const { setRetired } = await import("./retired");
    const now = new Date("2026-09-07T12:00:00Z");
    const [day] = await availableDays("consultation-30", now);
    const startTime = day?.slots[0];
    expect(day).toBeDefined();
    expect(startTime).toBeDefined();

    const appointment: StoredRequest = {
      reference: "CIT-TEST",
      kind: "appointment",
      submittedAt: now.toISOString(),
      locale: "en",
      client: { name: "Ana", email: "ana@example.com" },
      details: { date: day!.date, startTime: startTime!, minutes: 30 },
      status: "scheduled",
    };
    await saveRequest(appointment);
    expect((await availableDays("consultation-30", now))[0]?.slots).not.toContain(startTime);

    await setRetired("request", appointment.reference, true);
    expect((await availableDays("consultation-30", now))[0]?.slots).toContain(startTime);

    await setRetired("request", appointment.reference, false);
    expect((await availableDays("consultation-30", now))[0]?.slots).not.toContain(startTime);
  });
});

describe("a booking still waiting on its deposit", () => {
  const now = new Date("2026-09-07T12:00:00Z");
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

  async function holdAt(submittedAt: string, overrides: Partial<StoredRequest> = {}) {
    const { availableDays } = await import("./availability");
    const { saveRequest } = await import("./request-store");
    const [day] = await availableDays("consultation-30", now);
    const startTime = day!.slots[0]!;
    await saveRequest({
      reference: "CIT-HOLD",
      kind: "appointment",
      submittedAt,
      locale: "en",
      client: { name: "Ana", email: "ana@example.com" },
      details: { date: day!.date, startTime, minutes: 30 },
      awaitingPayment: true,
      status: "scheduled",
      ...overrides,
    });
    const [after] = await availableDays("consultation-30", now);
    return { startTime, slots: after?.slots ?? [] };
  }

  it("keeps the slot while the client may still be paying", async () => {
    const { startTime, slots } = await holdAt(minutesAgo(10));
    expect(slots).not.toContain(startTime);
  });

  it("frees the slot once the hold has run out", async () => {
    const { startTime, slots } = await holdAt(minutesAgo(46));
    expect(slots).toContain(startTime);
  });

  it("keeps the slot for a paid booking no matter how old", async () => {
    const { startTime, slots } = await holdAt(minutesAgo(600), {
      awaitingPayment: undefined,
      status: "paid",
      source: "stripe",
    });
    expect(slots).not.toContain(startTime);
  });
});

describe("a refunded booking", () => {
  it("gives its hour back like a closed one", async () => {
    const { availableDays } = await import("./availability");
    const { saveRequest } = await import("./request-store");
    const now = new Date("2026-09-07T12:00:00Z");
    const [day] = await availableDays("consultation-30", now);
    const startTime = day!.slots[0]!;
    await saveRequest({
      reference: "CIT-BACK",
      kind: "appointment",
      submittedAt: now.toISOString(),
      locale: "en",
      client: { name: "Ana", email: "ana@example.com" },
      details: { date: day!.date, startTime, minutes: 30 },
      status: "refunded",
      source: "stripe",
    });
    expect((await availableDays("consultation-30", now))[0]?.slots).toContain(startTime);
  });
});
