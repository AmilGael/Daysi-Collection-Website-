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

describe("hours and closures from the office", () => {
  it("offers nothing on a day inside a closure", async () => {
    const { saveClosure } = await import("./closures");
    const { availableDays } = await import("./availability");
    // A Wednesday well inside the booking horizon.
    const now = new Date("2026-10-05T12:00:00Z");
    const before = await availableDays("consultation-30", now);
    const target = before[2]!.date;

    await saveClosure({ id: "clo-test", from: target, to: target, note: "prueba" });

    const after = await availableDays("consultation-30", now);
    expect(before.some((day) => day.date === target)).toBe(true);
    expect(after.some((day) => day.date === target)).toBe(false);
  });

  it("uses her hours rather than the coded ones", async () => {
    const { saveHoursOverride } = await import("./live-hours");
    const { availableDays } = await import("./availability");
    const now = new Date("2026-10-05T12:00:00Z");

    // Close every weekday she is normally open; the calendar must empty out.
    for (const day of ["mon", "tue", "wed", "thu", "fri", "sat"] as const) {
      await saveHoursOverride({ day, opens: "", closes: "" });
    }

    expect(await availableDays("consultation-30", now)).toEqual([]);
  });
});
