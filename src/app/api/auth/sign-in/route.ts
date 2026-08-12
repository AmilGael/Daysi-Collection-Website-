import { NextResponse } from "next/server";
import { z } from "zod";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/security";
import { isLikelyBot } from "@/lib/validation";
import { sendSignInLink } from "@/lib/auth/sign-in-link";

/**
 * Asks for a sign-in link.
 *
 * The response is identical whether or not the address belongs to anyone. That
 * is the whole point: this endpoint would otherwise be a way to ask "is this
 * person a client of Daysi's?" one address at a time.
 */

const LINKS_PER_HOUR = 5;
const ONE_HOUR = 3600;

const schema = z.object({
  email: z.string().trim().max(160).email(),
  locale: z.enum(["es", "en"]),
  website: z.string().max(0).optional().default(""),
  renderedAt: z.coerce.number().int().nonnegative(),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  pruneRateLimits();
  // Limited per caller and per address: one machine cannot spray the internet,
  // and a shared office address cannot be used to bury one client in mail.
  const byCaller = checkRateLimit(callerKey(request, "sign-in"), LINKS_PER_HOUR, ONE_HOUR);
  if (!byCaller.allowed) {
    return NextResponse.json({ sent: true });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { email, locale } = parsed.data;
  const byAddress = checkRateLimit(`sign-in-address:${email.toLowerCase()}`, 3, ONE_HOUR);

  if (byAddress.allowed && !isLikelyBot(parsed.data)) {
    await sendSignInLink(email, locale);
  }

  return NextResponse.json({ sent: true });
}
