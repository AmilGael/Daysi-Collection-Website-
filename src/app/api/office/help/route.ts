import { NextResponse } from "next/server";
import { z } from "zod";
import { invalid, ownerRequest } from "@/lib/api-guard";
import { currentViewer } from "@/lib/auth/session";
import { helperEnabled } from "@/lib/env";
import { askOfficeHelper } from "@/lib/office-helper";
import { checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";

/**
 * The office's own "?", answering from the manual and the live price list.
 * It never writes anything, so unlike every other office route this one
 * takes `ownerRequest` rather than `ownerRoute`: there is no draft to apply
 * and no cache to drop on the way out.
 */

const QUESTIONS_PER_HOUR = 30;
const ONE_HOUR = 3600;

const helpSchema = z.object({
  question: z.string().trim().min(1).max(500),
  tab: z.string().trim().max(30),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().max(1000),
      }),
    )
    .max(6)
    .default([]),
});

export const POST = ownerRequest(async (request) => {
  if (!helperEnabled) {
    return NextResponse.json({ error: "helper-off" }, { status: 503 });
  }

  // Rate-limited per owner rather than per address: two office tabs open on
  // the same connection should share one budget, not double it.
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "not-found" }, { status: 404 });

  pruneRateLimits();
  const limit = checkRateLimit(`office-help:${viewer.account.email}`, QUESTIONS_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = helpSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();

  const answer = await askOfficeHelper(parsed.data);
  if (answer === null) {
    return NextResponse.json({ error: "no-answer" }, { status: 502 });
  }

  return NextResponse.json({ answer });
});
