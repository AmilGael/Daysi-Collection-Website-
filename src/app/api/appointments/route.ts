import { NextResponse } from "next/server";
import { findAppointmentType, translate } from "@/content";
import { availableDays, isSlotAvailable } from "@/lib/availability";
import { estimateAppointment } from "@/lib/pricing";
import { appointmentSchema, isLikelyBot } from "@/lib/validation";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin, newReference } from "@/lib/security";
import { notifyOwner } from "@/lib/notify";
import { saveRequest, type StoredRequest } from "@/lib/request-store";
import { createCheckoutSession } from "@/lib/payments";
import { paymentsEnabled } from "@/lib/env";

/**
 * Reading and booking the calendar.
 *
 * GET returns the free slots for a session length. POST books one — and
 * re-checks that the slot is still free at that moment, because the calendar a
 * client is looking at may be minutes old.
 */

const BOOKINGS_PER_HOUR = 4;
const ONE_HOUR = 3600;

export async function GET(request: Request) {
  const typeId = new URL(request.url).searchParams.get("type") ?? "";
  const type = findAppointmentType(typeId);
  if (!type) {
    return NextResponse.json({ error: "unknown-session" }, { status: 400 });
  }

  return NextResponse.json({
    days: await availableDays(type.id),
    estimate: estimateAppointment(type.id),
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "appointments"), BOOKINGS_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const parsed = appointmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const booking = parsed.data;
  if (isLikelyBot(booking)) {
    return NextResponse.json({ reference: newReference("CIT") });
  }

  const type = findAppointmentType(booking.appointmentTypeId);
  const estimate = estimateAppointment(booking.appointmentTypeId);
  if (!type || !estimate) {
    return NextResponse.json({ error: "unknown-session" }, { status: 400 });
  }

  const stillFree = await isSlotAvailable(type.id, booking.date, booking.startTime);
  if (!stillFree) {
    return NextResponse.json({ error: "slot-taken" }, { status: 409 });
  }

  const reference = newReference("CIT");
  const record: StoredRequest = {
    reference,
    kind: "appointment",
    submittedAt: new Date().toISOString(),
    locale: booking.client.locale,
    client: {
      name: booking.client.name,
      email: booking.client.email,
      phone: booking.client.phone,
      preferredContact: booking.client.preferredContact,
    },
    details: {
      // `date`, `startTime` and `minutes` are read back by the availability
      // check, so their names and types are part of that contract.
      date: booking.date,
      startTime: booking.startTime,
      minutes: type.minutes,
      Session: translate(type.name, "en"),
      Purpose: booking.purpose,
    },
    estimate,
    status: "scheduled",
  };

  await saveRequest(record);
  await notifyOwner(record);

  const checkout = paymentsEnabled
    ? await createCheckoutSession({
        reference,
        description: translate(type.name, booking.client.locale),
        estimate,
        customerEmail: booking.client.email,
        locale: booking.client.locale,
      })
    : null;

  return NextResponse.json({ reference, estimate, checkoutUrl: checkout?.url });
}
