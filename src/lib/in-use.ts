import type { GarmentStyle, PriceListEntry } from "@/content/types";
import { manageableStyles } from "./live-catalog";
import { manageablePriceList } from "./live-pricing";

/** Pure: how many of these styles price themselves through this entry. */
export function stylesUsingEntry(
  styles: readonly GarmentStyle[],
  entryId: string,
): number {
  return styles.filter((style) => style.priceEntryId === entryId).length;
}

/**
 * Pure: how many price themselves through any entry of this fabric. Falls
 * back to the `${category}--${fabric}` id shape when an entry is not listed.
 */
export function stylesUsingFabric(
  styles: readonly GarmentStyle[],
  entries: readonly PriceListEntry[],
  fabricId: string,
): number {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return styles.filter((style) => {
    const entry = byId.get(style.priceEntryId);
    return entry
      ? entry.fabricId === fabricId
      : style.priceEntryId.endsWith(`--${fabricId}`);
  }).length;
}

/** Pure: why restoring this style would leave it without a live price. */
export function restoreRefusal(
  style: GarmentStyle,
  priceList: readonly PriceListEntry[],
): "entry-retired" | undefined {
  return priceList.some((entry) => entry.id === style.priceEntryId)
    ? undefined
    : "entry-retired";
}

/** Live, active styles only. */
export function liveStylesUsingEntry(entryId: string): number {
  const styles = manageableStyles().filter((style) => !style.retired);
  return stylesUsingEntry(styles, entryId);
}

/** Live, active styles only. */
export function liveStylesUsingFabric(fabricId: string): number {
  const styles = manageableStyles().filter((style) => !style.retired);
  return stylesUsingFabric(styles, manageablePriceList(), fabricId);
}

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
