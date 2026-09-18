import { NextResponse } from "next/server";
import { z } from "zod";
import { helperEnabled } from "@/lib/env";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/security";
import { askSiteHelper, helperVisible } from "@/lib/site-helper";

/**
 * The public "¿Preguntas?" panel's own route: answers from the live price
 * list, alterations, sessions, hours and terms — never anything about a
 * client. Unlike the office's own "?" (`api/office/help`) there is no
 * session here to rate-limit by, so a visitor is identified the same way
 * `premiere-signups` identifies one.
 */

const QUESTIONS_PER_HOUR = 10;
const ONE_HOUR = 3600;

const helpSchema = z.object({
  question: z.string().trim().min(1).max(400),
  locale: z.enum(["es", "en"]),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().max(800),
      }),
    )
    .max(6)
    .default([]),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  if (!helperEnabled || !helperVisible()) {
    return NextResponse.json({ error: "helper-off" }, { status: 503 });
  }

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "help"), QUESTIONS_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = helpSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const answer = await askSiteHelper(parsed.data);
  if (answer === null) {
    return NextResponse.json({ error: "no-answer" }, { status: 502 });
  }

  return NextResponse.json({ answer });
}
