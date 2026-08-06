import { NextResponse } from "next/server";
import { findPremiere } from "@/content";
import { isLikelyBot, premiereSignupSchema } from "@/lib/validation";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin, newReference } from "@/lib/security";
import { notifyOwner } from "@/lib/notify";
import { saveRequest } from "@/lib/request-store";

/** The sign-up list for a limited-edition premiere. */

const SIGNUPS_PER_HOUR = 5;
const ONE_HOUR = 3600;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "signups"), SIGNUPS_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const parsed = premiereSignupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const signup = parsed.data;
  const reference = newReference("LST");
  if (isLikelyBot(signup)) {
    return NextResponse.json({ reference });
  }

  const premiere = findPremiere(signup.premiereId) ?? undefined;
  if (!premiere) {
    return NextResponse.json({ error: "unknown-premiere" }, { status: 400 });
  }

  const record = {
    reference,
    kind: "premiere-signup" as const,
    submittedAt: new Date().toISOString(),
    locale: signup.locale,
    client: { name: signup.name ?? "", email: signup.email },
    details: { Premiere: premiere.title.en, Season: premiere.season.en },
    status: "new" as const,
  };

  await saveRequest(record);
  await notifyOwner(record);

  return NextResponse.json({ reference });
}
