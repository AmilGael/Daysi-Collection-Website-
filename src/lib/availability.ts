import { business, findAppointmentType } from "@/content";
import { listRequests } from "./request-store";

/**
 * When Daysi can be booked. Slots are generated from the opening hours in
 * `business.ts`, then anything already taken is removed. The same function runs
 * on the page that shows the calendar and in the route handler that accepts a
 * booking, so a slot cannot be shown as free and then double booked.
 */

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

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * `business.hours` is indexed Monday first; JavaScript counts Sunday as zero.
 */
function hoursForWeekday(weekday: number) {
  const index = weekday === 0 ? 6 : weekday - 1;
  return business.hours[index];
}

async function bookedSlots(): Promise<Set<string>> {
  const appointments = await listRequests("appointment");
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

  for (let offset = 0; offset < BOOKING_HORIZON_DAYS; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    day.setHours(0, 0, 0, 0);

    const opening = hoursForWeekday(day.getDay());
    if (!opening || opening.closes === null) continue;

    const date = toDateKey(day);
    const opens = minutesSinceMidnight(opening.opens);
    const closes = minutesSinceMidnight(opening.closes);
    const slots: string[] = [];

    for (let at = opens; at + type.minutes <= closes; at += SLOT_STEP_MINUTES) {
      const startsAt = new Date(day);
      startsAt.setMinutes(at);
      if (startsAt.getTime() < earliest) continue;

      // Every half-hour step the appointment covers has to be free.
      const covered = Array.from(
        { length: Math.ceil(type.minutes / SLOT_STEP_MINUTES) },
        (_, step) => `${date}T${asTime(at + step * SLOT_STEP_MINUTES)}`,
      );
      if (covered.some((slot) => taken.has(slot))) continue;

      slots.push(asTime(at));
    }

    if (slots.length > 0) days.push({ date, weekday: day.getDay(), slots });
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
