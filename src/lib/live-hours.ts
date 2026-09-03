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
