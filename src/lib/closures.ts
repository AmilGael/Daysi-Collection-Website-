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
