import { NextResponse } from "next/server";
import { contactSchema, isLikelyBot } from "@/lib/validation";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin, newReference } from "@/lib/security";
import { recordRequest } from "@/lib/notify";

/** The general contact form. */

const MESSAGES_PER_HOUR = 5;
const ONE_HOUR = 3600;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "contact"), MESSAGES_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const parsed = contactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const submission = parsed.data;
  const reference = newReference("MSG");
  if (isLikelyBot(submission)) {
    return NextResponse.json({ reference });
  }

  const record = {
    reference,
    kind: "contact" as const,
    submittedAt: new Date().toISOString(),
    locale: submission.locale,
    client: {
      name: submission.name,
      email: submission.email,
      phone: submission.phone,
    },
    details: { Message: submission.message },
    status: "new" as const,
  };

  const delivered = await recordRequest(record);
  if (!delivered) {
    return NextResponse.json({ error: "not-recorded" }, { status: 500 });
  }

  return NextResponse.json({ reference });
}
