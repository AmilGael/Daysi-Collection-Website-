import { NextResponse } from "next/server";
import { z } from "zod";
import {
  estimateAlteration,
  estimateAppointment,
  estimateCommission,
  estimateReadyMade,
} from "@/lib/pricing";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/security";

/**
 * Prices a basket without recording anything. The estimate builder calls this
 * on every change so the figures a client sees are the same figures the request
 * handler will produce — there is only one pricing engine, and it lives on the
 * server.
 */

const estimateRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ready-made"),
    styleSlug: z.string().max(80),
    sizeId: z.string().max(4),
    customize: z.boolean(),
  }),
  z.object({
    kind: z.literal("commission"),
    categoryId: z.string().max(40),
    fabricId: z.string().max(40),
    customize: z.boolean(),
  }),
  z.object({
    kind: z.literal("alteration"),
    alterationIds: z.array(z.string().max(40)).max(8),
    rush: z.boolean(),
  }),
  z.object({
    kind: z.literal("appointment"),
    appointmentTypeId: z.string().max(40),
  }),
]);

const ESTIMATES_PER_MINUTE = 40;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "estimates"), ESTIMATES_PER_MINUTE, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const parsed = estimateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const input = parsed.data;
  const estimate =
    input.kind === "ready-made"
      ? estimateReadyMade(input)
      : input.kind === "commission"
        ? estimateCommission(input)
        : input.kind === "alteration"
          ? estimateAlteration(input)
          : estimateAppointment(input.appointmentTypeId);

  if (!estimate) {
    return NextResponse.json({ error: "unpriceable" }, { status: 400 });
  }

  return NextResponse.json({ estimate });
}
