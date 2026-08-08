import { business, findAppointmentType } from "@/content";
import { listRequests, type StoredRequest } from "./request-store";

/**
 * When Daysi can be booked. Slots are generated from the opening hours in
 * `business.ts`, then anything already taken is removed. The same function runs
 * on the page that shows the calendar and in the route handler that accepts a
 * booking, so a slot cannot be shown as free and then double booked.
 *
 * Every date and weekday here is computed in the atelier's own time zone, not
 * the server's. A production server usually runs on UTC, and computing "today"
 * there would roll the calendar over at 8 pm New York time — evening visitors
 * would see tomorrow's slots under today's date, and Friday's shorter hours
 * would land on the wrong day.
 */

const BUSINESS_TIME_ZONE = "America/New_York";

/** Bookings open this many days ahead, and no sooner than the lead time. */
const BOOKING_HORIZON_DAYS = 45;
const MINIMUM_LEAD_HOURS = 24;
const SLOT_STEP_MINUTES = 30;
/** Time left between appointments to write notes and reset the table. */
const BUFFER_MINUTES = 15;

export type DaySlots = {
  readonly date: string;
  readonly weekday: number;
  readonly slots: readonly string[];
};

function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function asTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const WEEKDAY_NUMBERS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** The calendar date and weekday an instant falls on in New York. */
function businessCalendarDay(instant: Date): { date: string; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(instant);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAY_NUMBERS[get("weekday")] ?? 0,
  };
}

/**
 * The instant a New York wall-clock time actually happens. The offset is read
 * for that date, so summer and winter time both come out right; within an hour
 * of the change itself the answer can be off by that hour, which for a
 * by-appointment atelier is acceptable.
 */
function businessInstant(date: string, time: string): Date {
  const nearby = new Date(`${date}T${time}:00Z`);
  const zoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    timeZoneName: "shortOffset",
  })
    .formatToParts(nearby)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(zoneName ?? "");
  const suffix = match
    ? `${match[1]}${match[2]!.padStart(2, "0")}:${match[3] ?? "00"}`
    : "-05:00";
  return new Date(`${date}T${time}:00${suffix}`);
}

/**
 * `business.hours` is indexed Monday first; JavaScript counts Sunday as zero.
 */
function hoursForWeekday(weekday: number) {
  const index = weekday === 0 ? 6 : weekday - 1;
  return business.hours[index];
}

/**
 * The store is append-only, so a reference can appear several times as its
 * status changes. Only the newest record speaks for the booking — that is what
 * lets a cancellation (appended as "closed") actually free its slot.
 */
function latestPerReference(records: readonly StoredRequest[]): StoredRequest[] {
  const latest = new Map<string, StoredRequest>();
  for (const record of records) latest.set(record.reference, record);
  return [...latest.values()];
}

async function bookedSlots(): Promise<Set<string>> {
  const appointments = latestPerReference(await listRequests("appointment"));
  const taken = new Set<string>();

  for (const appointment of appointments) {
    if (appointment.status === "closed") continue;
    const date = appointment.details.date;
    const start = appointment.details.startTime;
    const minutes = appointment.details.minutes;
    if (typeof date !== "string" || typeof start !== "string" || typeof minutes !== "number") {
      continue;
    }
    // Block the appointment itself plus the buffer that follows it.
    const from = minutesSinceMidnight(start);
    const until = from + minutes + BUFFER_MINUTES;
    for (let at = from; at < until; at += SLOT_STEP_MINUTES) {
      taken.add(`${date}T${asTime(at)}`);
    }
  }

  return taken;
}

export async function availableDays(
  appointmentTypeId: string,
  now: Date = new Date(),
): Promise<readonly DaySlots[]> {
  const type = findAppointmentType(appointmentTypeId);
  if (!type) return [];

  const taken = await bookedSlots();
  const earliest = now.getTime() + MINIMUM_LEAD_HOURS * 60 * 60 * 1000;
  const days: DaySlots[] = [];
  const seenDates = new Set<string>();

  for (let offset = 0; offset < BOOKING_HORIZON_DAYS; offset += 1) {
    const { date, weekday } = businessCalendarDay(
      new Date(now.getTime() + offset * 24 * 60 * 60 * 1000),
    );
    // Stepping by 24 hours can land on the same New York date twice across a
    // clock change; the calendar should still list each day once.
    if (seenDates.has(date)) continue;
    seenDates.add(date);

    const opening = hoursForWeekday(weekday);
    if (!opening || opening.closes === null) continue;

    const opens = minutesSinceMidnight(opening.opens);
    const closes = minutesSinceMidnight(opening.closes);
    const slots: string[] = [];

    for (let at = opens; at + type.minutes <= closes; at += SLOT_STEP_MINUTES) {
      if (businessInstant(date, asTime(at)).getTime() < earliest) continue;

      // Every half-hour step the appointment covers has to be free.
      const covered = Array.from(
        { length: Math.ceil(type.minutes / SLOT_STEP_MINUTES) },
        (_, step) => `${date}T${asTime(at + step * SLOT_STEP_MINUTES)}`,
      );
      if (covered.some((slot) => taken.has(slot))) continue;

      slots.push(asTime(at));
    }

    if (slots.length > 0) days.push({ date, weekday, slots });
  }

  return days;
}

/** Re-checks one slot at the moment a booking is submitted. */
export async function isSlotAvailable(
  appointmentTypeId: string,
  date: string,
  startTime: string,
  now: Date = new Date(),
): Promise<boolean> {
  const days = await availableDays(appointmentTypeId, now);
  return days.some((day) => day.date === date && day.slots.includes(startTime));
}
