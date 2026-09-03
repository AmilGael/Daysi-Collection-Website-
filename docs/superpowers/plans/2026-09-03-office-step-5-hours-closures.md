# Office step 5: hours and closures implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Daysi set her opening hours and close the atelier for a holiday from the office, without a deploy and without ever stranding a client who has already booked.

**Architecture:** Two append-only override collections, hours keyed by weekday and closures as dated ranges, merged by a new pure module that both the contact page and the booking engine read. Every change that would leave an existing appointment outside her hours or on a closed day is refused with a count, the same vocabulary the fabric and price rows already use. Editing stages into the Shopfront tab's existing draft and confirm bar.

**Tech Stack:** Next.js 15 App Router, React 19 server components, TypeScript strict, zod, next-intl 3.26.5, vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-office-hub-design.md`, Amendment 4 (2026-09-03).

## Global Constraints

- Money is whole cents. Not touched here; do not introduce a float.
- Copy is bilingual in `src/messages/es.json` and `src/messages/en.json`, both always updated together. Spanish is the default and Daysi's language. **No em dashes in any user-facing copy.**
- Every office write goes through `ownerAction` in `src/lib/action-guard.ts`. Never add a route handler for office data.
- Nothing saves until she presses Confirmar cambios. Staging only, on the client.
- Append-only store, `src/lib/records.ts` helpers only: `appendRecord`, `readRecords`, `latestBy`, `versionsOf`.
- **Every date and weekday is computed in `America/New_York`, never the server's zone.** `src/lib/availability.ts` already does this and explains why; follow it exactly. A plain `new Date()` comparison is a bug in this file.
- `business.hours` is a Monday-first array. JavaScript weekday numbers are Sunday-first. The existing `hoursForWeekday` converts; do not duplicate that conversion anywhere else.
- Tests are vitest, `src/**/*.test.ts`, run with `npm test`. Typecheck with `npm run typecheck`.
- Do not run `fly deploy` or `npm run deploy`. The user runs those.
- Commit after every task with the message in its final step.

---

### Task 1: Hours overrides and the merge

**Files:**
- Create: `src/lib/live-hours.ts`
- Create: `src/lib/live-hours.test.ts`

**Interfaces:**
- Consumes: `appendRecord`, `latestBy`, `readRecords` from `src/lib/records.ts`; `business` from `@/content`; `BusinessInfo` from `@/content/types`.
- Produces: `DAY_IDS`, `type DayId`, `type HoursOverride`, `hoursOverrides()`, `saveHoursOverride(override)`, `applyHours(coded, overrides)`, `liveHours()`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/live-hours.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DAY_IDS, applyHours, type HoursOverride } from "./live-hours";
import type { BusinessInfo } from "@/content/types";

const coded: BusinessInfo["hours"] = [
  { day: { en: "Monday", es: "Lunes" }, opens: "10:00", closes: "18:00" },
  { day: { en: "Tuesday", es: "Martes" }, opens: "10:00", closes: "18:00" },
  { day: { en: "Wednesday", es: "Miércoles" }, opens: "10:00", closes: "18:00" },
  { day: { en: "Thursday", es: "Jueves" }, opens: "10:00", closes: "18:00" },
  { day: { en: "Friday", es: "Viernes" }, opens: "10:00", closes: "16:00" },
  { day: { en: "Saturday", es: "Sábado" }, opens: "11:00", closes: "15:00" },
  { day: { en: "Sunday", es: "Domingo" }, opens: "", closes: null },
];

function override(patch: Partial<HoursOverride>): HoursOverride {
  return {
    day: "mon",
    opens: "09:00",
    closes: "17:00",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...patch,
  };
}

describe("DAY_IDS", () => {
  it("is Monday first, matching the coded hours array", () => {
    expect(DAY_IDS).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(DAY_IDS).toHaveLength(coded.length);
  });
});

describe("applyHours", () => {
  it("leaves the coded hours alone when there are no overrides", () => {
    expect(applyHours(coded, [])).toEqual([...coded]);
  });

  it("replaces one day's times and leaves the others", () => {
    const merged = applyHours(coded, [override({})]);
    expect(merged[0]).toMatchObject({ opens: "09:00", closes: "17:00" });
    expect(merged[1]).toEqual(coded[1]);
  });

  it("keeps the coded day names, which she never renames", () => {
    const merged = applyHours(coded, [override({})]);
    expect(merged[0]!.day).toEqual(coded[0]!.day);
  });

  it("writes a closed day the way the catalog writes one", () => {
    const merged = applyHours(coded, [override({ day: "sat", opens: "", closes: "" })]);
    expect(merged[5]).toMatchObject({ opens: "", closes: null });
  });

  it("opens a day the catalog had closed", () => {
    const merged = applyHours(coded, [override({ day: "sun", opens: "12:00", closes: "16:00" })]);
    expect(merged[6]).toMatchObject({ opens: "12:00", closes: "16:00" });
  });

  it("takes the newest record for a day", () => {
    const merged = applyHours(coded, [
      override({ opens: "08:00", closes: "12:00" }),
      override({ opens: "09:30", closes: "17:30" }),
    ]);
    expect(merged[0]).toMatchObject({ opens: "09:30", closes: "17:30" });
  });

  it("ignores an override naming a day that is not there", () => {
    expect(applyHours(coded, [override({ day: "xxx" as never })])).toEqual([...coded]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/live-hours.test.ts`
Expected: FAIL, cannot resolve `./live-hours`.

- [ ] **Step 3: Write the module**

Create `src/lib/live-hours.ts`:

```ts
import { business } from "@/content";
import type { BusinessInfo } from "@/content/types";
import { appendRecord, latestBy, readRecords } from "./records";

/**
 * Her opening hours, as she sets them.
 *
 * `business.hours` stays the hours the site shipped with. What she changes
 * lands here as append-only records, one per weekday. Two things make this
 * layer different from the others: the day names are NOT hers to change, and
 * the merged result feeds the booking calendar, so an edit here decides what a
 * client can book. A day is closed exactly the way the catalog writes it,
 * `opens: ""` with `closes: null`, so `BusinessInfo` never learns a new shape.
 */

/** Monday first, matching the order of `business.hours`. */
export const DAY_IDS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayId = (typeof DAY_IDS)[number];

export type HoursOverride = {
  readonly day: DayId;
  /** "10:00", or "" for a closed day. */
  readonly opens: string;
  /** "18:00", or "" for a closed day. */
  readonly closes: string;
  readonly updatedAt: string;
};

const HOURS = "hours-overrides";

export function hoursOverrides(): HoursOverride[] {
  return latestBy(readRecords<HoursOverride>(HOURS), (record) => record.day);
}

export async function saveHoursOverride(
  override: Omit<HoursOverride, "updatedAt">,
): Promise<void> {
  await appendRecord(HOURS, { ...override, updatedAt: new Date().toISOString() });
}

/** Pure, so it can be tested without touching the filesystem. */
export function applyHours(
  coded: BusinessInfo["hours"],
  overrides: readonly HoursOverride[],
): BusinessInfo["hours"] {
  const byDay = new Map(overrides.map((override) => [override.day, override]));
  return coded.map((day, index) => {
    const override = byDay.get(DAY_IDS[index]!);
    if (!override) return day;
    const opens = override.opens.trim();
    const closes = override.closes.trim();
    // A day with no closing time is a closed day, written as the catalog writes it.
    if (opens.length === 0 || closes.length === 0) {
      return { ...day, opens: "", closes: null };
    }
    return { ...day, opens, closes };
  });
}

/** Her hours as the site should read them right now. */
export function liveHours(): BusinessInfo["hours"] {
  return applyHours(business.hours, hoursOverrides());
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/live-hours.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-hours.ts src/lib/live-hours.test.ts
git commit -m "Let Daysi's opening hours override the coded ones"
```

---

### Task 2: Closures

**Files:**
- Create: `src/lib/closures.ts`
- Create: `src/lib/closures.test.ts`
- Modify: `src/lib/retired.ts` (add `closure` to `RetiredKind`)

**Interfaces:**
- Consumes: `records.ts` helpers; `retiredSet` from `src/lib/retired.ts`.
- Produces: `type Closure`, `allClosures()`, `activeClosures()`, `saveClosure(closure)`, `coversDate(closure, date)`, `closedOn(closures, date)`, `datesInClosure(closure)`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/closures.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { closedOn, coversDate, datesInClosure, type Closure } from "./closures";

const closure: Closure = {
  id: "clo-1",
  from: "2026-12-24",
  to: "2027-01-02",
  note: "Navidad",
  updatedAt: "2026-09-03T00:00:00.000Z",
};

describe("coversDate", () => {
  it("covers the first day", () => {
    expect(coversDate(closure, "2026-12-24")).toBe(true);
  });

  it("covers the last day", () => {
    expect(coversDate(closure, "2027-01-02")).toBe(true);
  });

  it("covers a day in the middle, across the year boundary", () => {
    expect(coversDate(closure, "2026-12-31")).toBe(true);
  });

  it("does not cover the day before or the day after", () => {
    expect(coversDate(closure, "2026-12-23")).toBe(false);
    expect(coversDate(closure, "2027-01-03")).toBe(false);
  });

  it("handles a single closed day written as the same date twice", () => {
    const one = { ...closure, from: "2026-11-05", to: "2026-11-05" };
    expect(coversDate(one, "2026-11-05")).toBe(true);
    expect(coversDate(one, "2026-11-06")).toBe(false);
  });
});

describe("closedOn", () => {
  it("is true when any closure covers the date", () => {
    expect(closedOn([closure], "2026-12-25")).toBe(true);
  });

  it("is false when none do", () => {
    expect(closedOn([closure], "2026-06-01")).toBe(false);
    expect(closedOn([], "2026-12-25")).toBe(false);
  });
});

describe("datesInClosure", () => {
  it("lists every date the range covers, inclusive", () => {
    const dates = datesInClosure({ ...closure, from: "2026-12-30", to: "2027-01-01" });
    expect(dates).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });

  it("lists one date for a single closed day", () => {
    expect(datesInClosure({ ...closure, from: "2026-11-05", to: "2026-11-05" }))
      .toEqual(["2026-11-05"]);
  });

  it("lists nothing when the range is backwards", () => {
    expect(datesInClosure({ ...closure, from: "2026-11-05", to: "2026-11-01" })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/closures.test.ts`
Expected: FAIL, cannot resolve `./closures`.

- [ ] **Step 3: Write the module and widen `RetiredKind`**

In `src/lib/retired.ts`, change line 4 only:

```ts
export type RetiredKind = "style" | "gallery" | "fabric" | "price-entry" | "request" | "closure";
```

Create `src/lib/closures.ts`:

```ts
import { appendRecord, latestBy, readRecords } from "./records";
import { retiredSet } from "./retired";

/**
 * The days the atelier is shut.
 *
 * A range rather than a day, because a trip is one entry and not fourteen.
 * Both ends are inclusive, and a single closed day is the same date twice. The
 * note is hers: it is never rendered on the public site.
 *
 * Dates are plain `YYYY-MM-DD` strings compared as strings, which is correct
 * because the format sorts lexicographically. Do NOT parse them into `Date`
 * here: a `Date` carries a zone, and the calendar this feeds is computed in
 * New York, not the server's zone.
 */

export type Closure = {
  readonly id: string;
  /** Inclusive, "YYYY-MM-DD". */
  readonly from: string;
  /** Inclusive, "YYYY-MM-DD". */
  readonly to: string;
  /** Hers, never public. */
  readonly note: string;
  readonly updatedAt: string;
};

const CLOSURES = "closures";

export function allClosures(): Closure[] {
  return latestBy(readRecords<Closure>(CLOSURES), (record) => record.id);
}

/** The closures in force: everything she has not retired. */
export function activeClosures(): Closure[] {
  const retired = retiredSet("closure");
  return allClosures().filter((closure) => !retired.has(closure.id));
}

/** Every closure including retired ones, each flagged, for the office view. */
export function manageableClosures(): (Closure & { retired: boolean })[] {
  const retired = retiredSet("closure");
  return allClosures().map((closure) => ({ ...closure, retired: retired.has(closure.id) }));
}

export async function saveClosure(closure: Omit<Closure, "updatedAt">): Promise<void> {
  await appendRecord(CLOSURES, { ...closure, updatedAt: new Date().toISOString() });
}

export function coversDate(closure: Closure, date: string): boolean {
  return closure.from <= date && date <= closure.to;
}

export function closedOn(closures: readonly Closure[], date: string): boolean {
  return closures.some((closure) => coversDate(closure, date));
}

/**
 * Every date the range covers. Stepping with UTC arithmetic on a date-only
 * string is safe: no clock change can move a calendar date that has no time.
 */
export function datesInClosure(closure: Closure): string[] {
  const dates: string[] = [];
  const last = Date.parse(`${closure.to}T00:00:00Z`);
  let at = Date.parse(`${closure.from}T00:00:00Z`);
  if (Number.isNaN(at) || Number.isNaN(last)) return [];
  while (at <= last) {
    dates.push(new Date(at).toISOString().slice(0, 10));
    at += 24 * 60 * 60 * 1000;
  }
  return dates;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/closures.test.ts && npm run typecheck`
Expected: PASS. The typecheck matters: widening `RetiredKind` must not break any existing `switch` over it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/closures.ts src/lib/closures.test.ts src/lib/retired.ts
git commit -m "Add closed spells as dated ranges, removable like everything else"
```

---

### Task 3: The booking calendar and the contact page read the live hours

**Files:**
- Modify: `src/lib/availability.ts`
- Modify: `src/app/[locale]/contact/page.tsx:46`
- Modify: `src/lib/availability.test.ts`

**Interfaces:**
- Consumes: `liveHours` from Task 1; `activeClosures`, `closedOn` from Task 2.
- Produces: no new exports. `availableDays` offers nothing on a closed date and reads her hours.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/availability.test.ts`, following that file's existing temporary-store harness (`vi.resetModules()`, `DATA_DIR`, dynamic imports). Read the top of the file first and copy its setup exactly.

```ts
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
```

`consultation-30` is the id that file already uses, and `saveRequest` from `./request-store` is how it writes an appointment; copy its `beforeEach` verbatim.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/availability.test.ts`
Expected: FAIL. The closed day is still offered and the calendar is not empty.

- [ ] **Step 3: Read the live hours and skip closed days**

In `src/lib/availability.ts`, add the imports:

```ts
import { activeClosures, closedOn } from "./closures";
import { liveHours } from "./live-hours";
```

Change `hoursForWeekday` to read the live hours, keeping the existing comment and the Monday-first conversion:

```ts
/**
 * `business.hours` is indexed Monday first; JavaScript counts Sunday as zero.
 * The hours themselves are whatever Daysi has set in the office, falling back
 * to the coded ones.
 */
function hoursForWeekday(weekday: number) {
  const index = weekday === 0 ? 6 : weekday - 1;
  return liveHours()[index];
}
```

In `availableDays`, read the closures once before the loop and skip a covered date, immediately after the `seenDates` guard:

```ts
  const closures = activeClosures();
```

```ts
    if (seenDates.has(date)) continue;
    seenDates.add(date);
    if (closedOn(closures, date)) continue;
```

In `src/app/[locale]/contact/page.tsx`, replace `business.hours.map(` with `liveHours().map(` and add `import { liveHours } from "@/lib/live-hours";`. Leave every other use of `business` on that page alone.

- [ ] **Step 4: Pin that nothing goes back to reading the coded hours**

The spec asks for this, and it is the mistake that would let the printed hours
and the bookable hours drift apart again. Append to `src/lib/live-hours.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";

describe("who reads the hours", () => {
  it("is nobody but live-hours itself", () => {
    const roots = ["src/app", "src/components", "src/lib"];
    const offenders: string[] = [];

    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
          if (full.endsWith(path.join("src", "lib", "live-hours.ts"))) continue;
          if (/business\.hours/.test(fs.readFileSync(full, "utf8"))) offenders.push(full);
        }
      }
    };

    for (const root of roots) walk(path.join(process.cwd(), root));
    expect(offenders).toEqual([]);
  });
});
```

Run: `npx vitest run src/lib/live-hours.test.ts`
Expected: PASS. If it fails it names the file still reading the coded hours; move that file to `liveHours()` too.

- [ ] **Step 5: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/availability.ts src/lib/availability.test.ts src/lib/live-hours.test.ts "src/app/[locale]/contact/page.tsx"
git commit -m "Read her hours and skip her closed days when offering appointments"
```

---

### Task 4: The two clash checks

**Files:**
- Modify: `src/lib/in-use.ts`
- Modify: `src/lib/in-use.test.ts`

**Interfaces:**
- Consumes: `activeRequests` from `src/lib/request-store.ts`; `Closure`, `datesInClosure` from Task 2; `DayId`, `DAY_IDS` from Task 1.
- Produces: `appointmentsOnDates(appointments, dates)`, `appointmentsOutsideHours(appointments, day, opens, closes, today)`, and the live wrappers `bookingsInClosure(closure)` and `bookingsOutsideHours(day, opens, closes)`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/in-use.test.ts`:

```ts
import { appointmentsOnDates, appointmentsOutsideHours } from "./in-use";
import type { StoredRequest } from "./request-store";

function appointment(date: string, startTime: string, minutes = 60): StoredRequest {
  return {
    reference: `APT-${date}-${startTime}`,
    kind: "appointment",
    submittedAt: "2026-09-03T12:00:00.000Z",
    locale: "es",
    client: { name: "Ana", email: "ana@example.com" },
    details: { date, startTime, minutes },
    status: "new",
  } as StoredRequest;
}

describe("appointmentsOnDates", () => {
  it("counts the appointments falling on any of the dates", () => {
    const booked = [appointment("2026-12-24", "11:00"), appointment("2026-12-28", "11:00")];
    expect(appointmentsOnDates(booked, ["2026-12-24", "2026-12-25"])).toBe(1);
  });

  it("counts nothing when the days are free", () => {
    expect(appointmentsOnDates([appointment("2026-12-24", "11:00")], ["2026-12-26"])).toBe(0);
  });

  it("ignores an appointment already closed out", () => {
    const done = { ...appointment("2026-12-24", "11:00"), status: "closed" } as StoredRequest;
    expect(appointmentsOnDates([done], ["2026-12-24"])).toBe(0);
  });
});

describe("appointmentsOutsideHours", () => {
  const today = "2026-10-01";

  it("counts a booking that starts before the new opening time", () => {
    // 2026-10-05 is a Monday.
    expect(appointmentsOutsideHours([appointment("2026-10-05", "09:00")], "mon", "10:00", "18:00", today)).toBe(1);
  });

  it("counts a booking that would run past the new closing time", () => {
    expect(appointmentsOutsideHours([appointment("2026-10-05", "17:30")], "mon", "10:00", "18:00", today)).toBe(1);
  });

  it("counts nothing when the booking still fits", () => {
    expect(appointmentsOutsideHours([appointment("2026-10-05", "11:00")], "mon", "10:00", "18:00", today)).toBe(0);
  });

  it("counts every booking when the day is being closed", () => {
    expect(appointmentsOutsideHours([appointment("2026-10-05", "11:00")], "mon", "", "", today)).toBe(1);
  });

  it("ignores a booking on a different weekday", () => {
    // 2026-10-06 is a Tuesday.
    expect(appointmentsOutsideHours([appointment("2026-10-06", "09:00")], "mon", "10:00", "18:00", today)).toBe(0);
  });

  it("ignores a booking already in the past, which cannot be stranded", () => {
    expect(appointmentsOutsideHours([appointment("2026-09-28", "09:00")], "mon", "10:00", "18:00", today)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/in-use.test.ts`
Expected: FAIL, neither function is exported.

- [ ] **Step 3: Write the checks**

Append to `src/lib/in-use.ts`:

```ts
import { activeRequests, type StoredRequest } from "./request-store";
import { datesInClosure, type Closure } from "./closures";
import { DAY_IDS, type DayId } from "./live-hours";

/**
 * A booking she has not closed out yet. A closed appointment has happened, so
 * shutting that day cannot strand anybody.
 */
function pending(appointment: StoredRequest): boolean {
  return appointment.status !== "closed";
}

function detail(appointment: StoredRequest) {
  const { date, startTime, minutes } = appointment.details;
  return typeof date === "string" && typeof startTime === "string" && typeof minutes === "number"
    ? { date, startTime, minutes }
    : undefined;
}

function toMinutes(time: string): number {
  const [hours, rest] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (rest ?? 0);
}

/** The weekday a plain date falls on, as a DayId. Date-only, so UTC is safe. */
function dayIdOf(date: string): DayId | undefined {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed)) return undefined;
  // getUTCDay is Sunday-first; DAY_IDS is Monday-first.
  const weekday = new Date(parsed).getUTCDay();
  return DAY_IDS[weekday === 0 ? 6 : weekday - 1];
}

/** Pure: how many live bookings fall on any of these dates. */
export function appointmentsOnDates(
  appointments: readonly StoredRequest[],
  dates: readonly string[],
): number {
  const wanted = new Set(dates);
  return appointments.filter((appointment) => {
    if (!pending(appointment)) return false;
    const booked = detail(appointment);
    return booked !== undefined && wanted.has(booked.date);
  }).length;
}

/**
 * Pure: how many live bookings on this weekday would fall outside the new
 * hours. Past dates are ignored: they cannot be stranded. Empty times mean the
 * day is being closed, which strands every booking on it.
 */
export function appointmentsOutsideHours(
  appointments: readonly StoredRequest[],
  day: DayId,
  opens: string,
  closes: string,
  today: string,
): number {
  const closing = opens.trim().length === 0 || closes.trim().length === 0;
  const from = closing ? 0 : toMinutes(opens);
  const until = closing ? 0 : toMinutes(closes);

  return appointments.filter((appointment) => {
    if (!pending(appointment)) return false;
    const booked = detail(appointment);
    if (booked === undefined || booked.date < today) return false;
    if (dayIdOf(booked.date) !== day) return false;
    if (closing) return true;
    const start = toMinutes(booked.startTime);
    return start < from || start + booked.minutes > until;
  }).length;
}

/** How many live bookings this closed spell would strand. */
export function bookingsInClosure(closure: Closure): number {
  return appointmentsOnDates(activeRequests("appointment"), datesInClosure(closure));
}

/** How many live bookings these new hours would strand. */
export function bookingsOutsideHours(
  day: DayId,
  opens: string,
  closes: string,
  today: string,
): number {
  return appointmentsOutsideHours(activeRequests("appointment"), day, opens, closes, today);
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/in-use.ts src/lib/in-use.test.ts
git commit -m "Count the bookings a closure or a shorter day would strand"
```

---

### Task 5: Validation for the three new changes

**Files:**
- Modify: `src/lib/office-validation.ts`
- Modify: `src/lib/office-validation.test.ts`

**Interfaces:**
- Consumes: `DAY_IDS` from Task 1.
- Produces: `hoursChangeSchema`, `closureAddSchema`, both members of `shopfrontChangeSchema` alongside the existing notice and the shared retire and restore; `UNDO_KINDS` grows by `"hours"`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/office-validation.test.ts`:

```ts
describe("shopfront hours and closures", () => {
  const hours = {
    type: "hours" as const,
    key: "hours:mon",
    day: "mon" as const,
    opens: "09:00",
    closes: "17:00",
  };

  it("accepts a day's new times", () => {
    expect(shopfrontChangeSchema.safeParse(hours).success).toBe(true);
  });

  it("accepts empty times, which close the day", () => {
    expect(shopfrontChangeSchema.safeParse({ ...hours, opens: "", closes: "" }).success).toBe(true);
  });

  it("refuses a time that is not a time", () => {
    expect(shopfrontChangeSchema.safeParse({ ...hours, opens: "9am" }).success).toBe(false);
    expect(shopfrontChangeSchema.safeParse({ ...hours, closes: "25:00" }).success).toBe(false);
  });

  it("refuses a day that is not a day", () => {
    expect(shopfrontChangeSchema.safeParse({ ...hours, day: "funday" }).success).toBe(false);
  });

  it("refuses a closing time at or before the opening time", () => {
    expect(shopfrontChangeSchema.safeParse({ ...hours, opens: "17:00", closes: "09:00" }).success).toBe(false);
    expect(shopfrontChangeSchema.safeParse({ ...hours, opens: "09:00", closes: "09:00" }).success).toBe(false);
  });

  const closure = {
    type: "closure-add" as const,
    key: "closure:1",
    from: "2026-12-24",
    to: "2027-01-02",
    note: "Navidad",
  };

  it("accepts a closed range", () => {
    expect(shopfrontChangeSchema.safeParse(closure).success).toBe(true);
  });

  it("accepts a single closed day as the same date twice", () => {
    expect(shopfrontChangeSchema.safeParse({ ...closure, from: "2026-11-05", to: "2026-11-05" }).success).toBe(true);
  });

  it("refuses a range that ends before it starts", () => {
    expect(shopfrontChangeSchema.safeParse({ ...closure, from: "2026-12-24", to: "2026-12-01" }).success).toBe(false);
  });

  it("refuses a date that is not a date", () => {
    expect(shopfrontChangeSchema.safeParse({ ...closure, from: "24/12/2026" }).success).toBe(false);
  });

  it("still accepts the notice, and retire and restore", () => {
    expect(shopfrontChangeSchema.safeParse({
      type: "notice", key: "notice:site", message: "Hola", visible: true,
    }).success).toBe(true);
    expect(shopfrontChangeSchema.safeParse({ type: "retire", key: "r:1", id: "clo-1" }).success).toBe(true);
  });
});

describe("UNDO_KINDS", () => {
  it("carries the hours stream", () => {
    expect(UNDO_KINDS).toContain("hours");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/office-validation.test.ts`
Expected: FAIL, the shopfront union has no `hours` member.

- [ ] **Step 3: Add the schemas**

In `src/lib/office-validation.ts`, above `shopfrontChangeSchema`:

```ts
/** "HH:MM" on a 24 hour clock, or "" for a closed day. */
const clockTime = z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]);
/** "YYYY-MM-DD". String comparison orders these correctly, which the ranges rely on. */
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const hoursChangeSchema = z
  .object({
    type: z.literal("hours"),
    key: changeKey,
    day: z.enum(DAY_IDS),
    opens: clockTime,
    closes: clockTime,
  })
  .refine(
    (change) =>
      (change.opens === "") === (change.closes === "") &&
      (change.opens === "" || change.opens < change.closes),
    { message: "closing time must be after opening time" },
  );

export const closureAddSchema = z
  .object({
    type: z.literal("closure-add"),
    key: changeKey,
    from: calendarDate,
    to: calendarDate,
    note: z.string().trim().max(120),
  })
  .refine((change) => change.from <= change.to, { message: "range ends before it starts" });
```

Import `DAY_IDS` at the top: `import { DAY_IDS } from "./live-hours";`

Both carry a `.refine`, so they are `ZodEffects` and `z.discriminatedUnion` will not take them. The shopfront union therefore becomes a plain `z.union`. This is safe here and NOT the situation from step 4: the shopfront tab's changes are matched by an explicit `switch (change.type)` in its action, not by discriminated error reporting, and no other union changes.

```ts
export const shopfrontChangeSchema = z.union([
  z.object({
    type: z.literal("notice"),
    key: changeKey,
    message: z.string().trim().max(300),
    visible: z.boolean(),
  }),
  hoursChangeSchema,
  closureAddSchema,
  retireChangeSchema,
  restoreChangeSchema,
]);
```

Copy the existing notice member's exact field definitions from the current file rather than the sketch above, then add `"hours"` to `UNDO_KINDS`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/office-validation.test.ts && npm run typecheck`
Expected: the vitest run passes. The typecheck will FAIL with a non-exhaustive `switch` in `src/lib/office-history.ts` because `UNDO_KINDS` now names a stream that does not exist. That is expected and Task 6 fixes it. Report the error and move on; do not patch it here.

- [ ] **Step 5: Commit**

```bash
git add src/lib/office-validation.ts src/lib/office-validation.test.ts
git commit -m "Validate an hours row and a closed range"
```

---

### Task 6: Undo for an hours row

**Files:**
- Modify: `src/lib/office-history.ts`
- Modify: `src/lib/office-history.test.ts`

**Interfaces:**
- Consumes: `HoursOverride`, `DAY_IDS` from Task 1; `business` from `@/content`.
- Produces: `previousChangeFor("hours", day)` and `undoableIds("hours")`, keyed by the day id.

> **Order note:** this task must run immediately after Task 5. `npm run typecheck` is red between them.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/office-history.test.ts`, following that file's existing harness:

```ts
describe("hours undo", () => {
  it("stages the previous times", async () => {
    const { saveHoursOverride } = await import("./live-hours");
    const { previousChangeFor } = await import("./office-history");
    await saveHoursOverride({ day: "mon", opens: "09:00", closes: "17:00" });
    await saveHoursOverride({ day: "mon", opens: "08:00", closes: "16:00" });

    expect(previousChangeFor("hours", "mon")).toMatchObject({
      type: "hours",
      day: "mon",
      opens: "09:00",
      closes: "17:00",
    });
  });

  it("stages a return to the coded times when there is only one version", async () => {
    const { saveHoursOverride } = await import("./live-hours");
    const { previousChangeFor } = await import("./office-history");
    const { business } = await import("@/content");
    await saveHoursOverride({ day: "tue", opens: "08:00", closes: "12:00" });

    expect(previousChangeFor("hours", "tue")).toMatchObject({
      type: "hours",
      day: "tue",
      opens: business.hours[1]!.opens,
      closes: business.hours[1]!.closes ?? "",
    });
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/office-history.test.ts`
Expected: FAIL, `streamFor` has no case for `hours`.

- [ ] **Step 3: Add the stream**

In `src/lib/office-history.ts`:

```ts
import { DAY_IDS, type HoursOverride } from "./live-hours";
```

```ts
/**
 * Keyed by the day id. The baseline is the day as the site shipped, so undoing
 * a first edit puts the coded times back. A closed coded day carries `closes:
 * null`, which becomes "" on the wire.
 */
const hours = recordStream<HoursOverride>(
  "hours-overrides",
  (record) => record.day,
  (id) => {
    const index = DAY_IDS.indexOf(id as (typeof DAY_IDS)[number]);
    const coded = index === -1 ? undefined : business.hours[index];
    return coded
      ? {
          type: "hours",
          key: `hours:${id}`,
          day: id as (typeof DAY_IDS)[number],
          opens: coded.opens,
          closes: coded.closes ?? "",
        }
      : undefined;
  },
  (record, id) => ({
    type: "hours",
    key: `hours:${id}`,
    day: id as (typeof DAY_IDS)[number],
    opens: record.opens,
    closes: record.closes,
  }),
);
```

Add `business` to the existing `@/content` import, and add the case to `streamFor`:

```ts
    case "hours": return erased(hours);
```

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS, and the typecheck is green again.

- [ ] **Step 5: Commit**

```bash
git add src/lib/office-history.ts src/lib/office-history.test.ts
git commit -m "Undo an hours row back to its previous times or the coded ones"
```

---

### Task 7: The shopfront action applies the three changes and refuses the clashes

**Files:**
- Modify: `src/app/[locale]/office/shopfront/actions.ts`
- Modify: `src/messages/es.json`, `src/messages/en.json`
- Modify: `src/lib/action-guard.test.ts`

**Interfaces:**
- Consumes: `saveHoursOverride` (Task 1), `saveClosure`, `manageableClosures` (Task 2), `bookingsInClosure`, `bookingsOutsideHours` (Task 4), `setRetired`, `newReference`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/action-guard.test.ts`, giving the new describe block its own temporary store exactly as the `collection action text limits` block does (`vi.resetModules()`, `mkdtempSync`, `DATA_DIR`, `afterEach` cleanup):

```ts
describe("shopfront refuses a change that would strand a booking", () => {
  it("refuses a closure over a booked day, with the count", async () => {
    viewer.mockResolvedValue({ role: "owner" } as Awaited<ReturnType<typeof currentViewer>>);
    const { saveRequest } = await import("@/lib/request-store");
    const { applyShopfrontChanges } = await import("@/app/[locale]/office/shopfront/actions");

    await saveRequest({
      reference: "APT-1",
      kind: "appointment",
      submittedAt: "2026-09-03T12:00:00.000Z",
      locale: "es",
      client: { name: "Ana", email: "ana@example.com" },
      details: { date: "2036-12-24", startTime: "11:00", minutes: 60 },
      status: "new",
    });

    const key = "closure:1";
    await expect(applyShopfrontChanges([{
      type: "closure-add", key, from: "2036-12-24", to: "2036-12-26", note: "Navidad",
    }])).resolves.toEqual({
      ok: true,
      results: [{ key, ok: false, error: "day-booked", count: 1 }],
    });
  });
});
```

`saveRequest(request: StoredRequest)` at `src/lib/request-store.ts:84` is the writer, and `src/lib/availability.test.ts` shows the shape of a stored appointment. The date is deliberately far in the future so the test does not rot.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/action-guard.test.ts`
Expected: FAIL, the action has no case for `closure-add`.

- [ ] **Step 3: Rewrite the action**

`src/app/[locale]/office/shopfront/actions.ts` currently assumes one change type and has no switch. Give it one:

```ts
"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { manageableClosures, saveClosure } from "@/lib/closures";
import { saveNotice } from "@/lib/live-catalog";
import { saveHoursOverride } from "@/lib/live-hours";
import { bookingsInClosure, bookingsOutsideHours } from "@/lib/in-use";
import { changesOf, shopfrontChangeSchema } from "@/lib/office-validation";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";

/** Today in the atelier's own zone, which is the only "today" that counts. */
function businessToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const applyShopfrontChanges = ownerAction(
  changesOf(shopfrontChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      switch (change.type) {
        case "notice":
          await saveNotice({ message: change.message, visible: change.visible });
          return;
        case "hours": {
          const stranded = bookingsOutsideHours(
            change.day,
            change.opens,
            change.closes,
            businessToday(),
          );
          if (stranded > 0) throw new ChangeRefused("day-booked", stranded);
          await saveHoursOverride({
            day: change.day,
            opens: change.opens,
            closes: change.closes,
          });
          return;
        }
        case "closure-add": {
          const closure = {
            id: newReference("CLO").toLowerCase(),
            from: change.from,
            to: change.to,
            note: change.note,
          };
          const stranded = bookingsInClosure({ ...closure, updatedAt: "" });
          if (stranded > 0) throw new ChangeRefused("day-booked", stranded);
          await saveClosure(closure);
          return;
        }
        case "retire":
          if (!manageableClosures().some((closure) => closure.id === change.id)) {
            throw new ChangeRefused("unknown-closure");
          }
          await setRetired("closure", change.id, true);
          return;
        case "restore": {
          const closure = manageableClosures().find((candidate) => candidate.id === change.id);
          if (!closure) throw new ChangeRefused("unknown-closure");
          const stranded = bookingsInClosure(closure);
          if (stranded > 0) throw new ChangeRefused("day-booked", stranded);
          await setRetired("closure", change.id, false);
        }
      }
    }),
  {
    revalidate: [
      "/[locale]/office/shopfront",
      "/[locale]",
      "/[locale]/appointments",
      "/[locale]/contact",
    ],
  },
);
```

Restoring a closure runs the same check as adding one: a spell she retired, then filled with bookings, must not silently swallow them again.

- [ ] **Step 4: Add the copy to both bundles**

In the `error` object of `src/messages/es.json`:

```json
"day-booked": "{count, plural, one {Hay # cita ese día} other {Hay # citas esos días}}. Muévalas o retírelas en Trabajo primero.",
"unknown-closure": "No se encontró ese cierre."
```

In `src/messages/en.json`:

```json
"day-booked": "{count, plural, one {There is # appointment on that day} other {There are # appointments on those days}}. Move or retire them under Trabajo first.",
"unknown-closure": "That closed spell could not be found."
```

No em dashes.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/office/shopfront/actions.ts" src/lib/action-guard.test.ts src/messages/es.json src/messages/en.json
git commit -m "Apply hours and closures, and refuse the ones that would strand a client"
```

---

### Task 8: The Shopfront tab gets both editors

**Files:**
- Create: `src/components/office/hours-editor.tsx`
- Create: `src/components/office/closures-editor.tsx`
- Modify: `src/app/[locale]/office/shopfront/page.tsx`
- Modify: `src/messages/es.json`, `src/messages/en.json`

**Interfaces:**
- Consumes: `useOfficeDraft`, `DraftChange` from `src/components/office/use-office-draft.tsx`; `UndoLink`; `Pending` from `confirm-bar`; `RetiredGroup` and `RetireButton` from `src/components/office/retired-group.tsx`.
- Produces: `<HoursEditor rows undoable />` and `<ClosuresEditor active retired />`.

- [ ] **Step 1: Read the components you are matching**

Read `src/components/notice-editor.tsx`, `src/components/office/text-fields.tsx`, and `src/components/office/retired-group.tsx` before writing anything. Match their class vocabulary, their pending mark and their unstage wording. Do not invent new visual language.

- [ ] **Step 2: Write the hours editor**

`src/components/office/hours-editor.tsx`, a client component. Seven rows, one per day. Each row shows the day's Spanish or English name (already translated by the page), two time inputs, and a "cerrado" checkbox that empties both. Editing stages one change per day:

```tsx
const key = `hours:${row.day}`;
draft.stage(key, {
  wire: { type: "hours", key, day: row.day, opens, closes } as OfficeChange,
});
```

If the typed times equal the ones the page passed in, call `draft.unstage(key)` instead, so a no-op edit does not sit in the draft. Show `Pending` on a staged row, and `UndoLink` with `kind="hours"` and `id={row.day}` when `undoable.has(row.day)` and nothing is staged for it. Give each input a `key` that includes the value it should show, for the reason recorded in step 4's review: an uncontrolled input stops following the draft once typed in, so Descartar would leave stale times on screen.

- [ ] **Step 3: Write the closures editor**

`src/components/office/closures-editor.tsx`. Lists the active closed spells, each with its dates, its note, and a `RetireButton` that stages `{ type: "retire", key, id }`. Under it, a form with two date inputs and a note, where leaving the second date empty means a single day, staging:

```tsx
const key = `closure:${from}:${to}`;
draft.stage(key, {
  wire: { type: "closure-add", key, from, to: to || from, note } as OfficeChange,
});
```

Retired spells go in a `RetiredGroup` with restore, exactly as the other tabs do.

- [ ] **Step 4: Feed both from the page**

In `src/app/[locale]/office/shopfront/page.tsx`, add above the existing notice section:

```ts
import { manageableClosures } from "@/lib/closures";
import { DAY_IDS, liveHours } from "@/lib/live-hours";
import { translate } from "@/content";
```

```ts
  const undoableHours = undoableIds("hours");
  const hourRows = liveHours().map((day, index) => ({
    day: DAY_IDS[index]!,
    label: translate(day.day, language),
    opens: day.opens,
    closes: day.closes ?? "",
  }));
  const closures = manageableClosures();
```

The page currently does not read `locale` into a `Locale`; add that the way `src/app/[locale]/office/collection/page.tsx` does.

- [ ] **Step 5: Add the copy to both bundles**

Spanish: `hoursTitle` "Sus horas", `hoursLead` "A qué hora abre y cierra cada día. La agenda de citas usa estas horas, así que un cambio aquí cambia lo que un cliente puede reservar.", `hoursOpens` "Abre", `hoursCloses` "Cierra", `hoursClosed` "Cerrado", `closuresTitle` "Días cerrados", `closuresLead` "Un viaje, una fiesta, una semana de familia. Esos días salen de la agenda y nadie los puede reservar.", `closuresFrom` "Desde", `closuresTo` "Hasta", `closuresNote` "Para acordarse", `closuresAdd` "Agregarlo a los cambios", `closuresSingle` "Deje Hasta en blanco para cerrar un solo día."

English: `hoursTitle` "Your hours", `hoursLead` "When you open and close each day. The booking calendar uses these hours, so a change here changes what a client can book.", `hoursOpens` "Opens", `hoursCloses` "Closes", `hoursClosed` "Closed", `closuresTitle` "Closed days", `closuresLead` "A trip, a holiday, a week with family. Those days leave the calendar and nobody can book them.", `closuresFrom` "From", `closuresTo` "To", `closuresNote` "So you remember", `closuresAdd` "Add it to your changes", `closuresSingle` "Leave To blank to close a single day."

No em dashes.

- [ ] **Step 6: Run everything**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/office/hours-editor.tsx src/components/office/closures-editor.tsx "src/app/[locale]/office/shopfront/page.tsx" src/messages/es.json src/messages/en.json
git commit -m "Set the hours and close a spell from the Shopfront tab"
```

---

### Task 9: Browser pass, the manual and the status doc

**Files:**
- Modify: `docs/manual-del-taller.html`
- Modify: `docs/next-steps.md`

- [ ] **Step 1: Run the site**

Open the Browser pane with the `.claude/launch.json` entry. Do not run `next build` while the dev server is up. Local owner sign-in prints its link to the dev server log; the owner address is in `.env.local`. **The pane honours the site's HSTS header on localhost, so a form that posts via fetch fails silently there.** If the sign-in form will not submit, drive it with `curl` from the shell as recorded in the step 4 session, or verify against the deployed site in a real browser instead.

- [ ] **Step 2: Walk the five checks**

1. Change Friday's closing time, confirm, then open the contact page and check the printed hours changed.
2. Book nothing, close a range a week out, confirm, then open the booking calendar and check those days are gone.
3. Retire that closure, confirm, and check the days come back.
4. Book an appointment, then try to close that day. Read the refusal and check it names the count.
5. With that booking still live, try to move that weekday's closing time to before it. Read the same refusal.

- [ ] **Step 3: Write it down**

Add a section to `docs/manual-del-taller.html` in Daysi's Spanish, matching the surrounding tone, covering: her hours are hers to change, the calendar uses them, closing a spell takes those days off the calendar, and the site will refuse and tell her the number if somebody is already booked. Insert it after the current section 05 and renumber the sections and their HTML comments below it, both together. Section numbering has bitten this file once already.

Update `docs/next-steps.md` with a step 5 section in the same plain voice as the others.

- [ ] **Step 4: Commit**

```bash
git add docs/manual-del-taller.html docs/next-steps.md
git commit -m "Write down the hours and the closed days for Daysi"
```

---

## After the plan

One pull request from `office-step-5` against `main`, CI green, one opus whole-branch review, then a fix wave and a clean re-review before merging. The user runs `npm run deploy`.
