import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { consumeSignInLink } from "@/lib/auth/sign-in-link";
import { roleFor } from "@/lib/auth/accounts";
import { startSession } from "@/lib/auth/session";

/**
 * Where a sign-in link lands.
 *
 * This is a GET that changes state, which is normally a mistake — but an email
 * client can only follow links, and the token itself is the single-use proof.
 * It is rate limited so the token space cannot be walked, and it always ends
 * in a redirect so the credential never stays in the address bar of a page
 * the client might share or screenshot.
 */

const ATTEMPTS_PER_HOUR = 20;
const ONE_HOUR = 3600;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const locale = url.searchParams.get("locale") === "en" ? "en" : "es";

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "verify"), ATTEMPTS_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in?error=rate`, env.siteUrl));
  }

  const account = token ? await consumeSignInLink(token) : null;
  if (!account) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in?error=link`, env.siteUrl));
  }

  await startSession(account.id);

  // Daysi lands in her office; a client lands in their account.
  const destination = roleFor(account) === "owner" ? "office" : "account";
  return NextResponse.redirect(new URL(`/${account.locale}/${destination}`, env.siteUrl));
}
