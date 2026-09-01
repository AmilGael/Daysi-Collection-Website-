import { NextResponse } from "next/server";
import { env, googleAuthEnabled } from "@/lib/env";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { consumeGoogleState, fetchGoogleProfile } from "@/lib/auth/google";
import { findOrCreateAccount, roleFor } from "@/lib/auth/accounts";
import { startSession } from "@/lib/auth/session";

/**
 * Where Google sends the browser back. The same shape as the email-link
 * verify route: prove the credential, start the one kind of session there is,
 * and land Daysi in her office or a client in their account. Every failure
 * exits through the same door, so the URL cannot be used to probe anything.
 */

const ATTEMPTS_PER_HOUR = 20;
const ONE_HOUR = 3600;

export async function GET(request: Request) {
  const url = new URL(request.url);

  const fail = (locale: "es" | "en") =>
    NextResponse.redirect(new URL(`/${locale}/sign-in?error=link`, env.siteUrl));

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "google"), ATTEMPTS_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return NextResponse.redirect(new URL(`/es/sign-in?error=rate`, env.siteUrl));
  }

  const locale = await consumeGoogleState(url.searchParams.get("state") ?? "");
  if (!googleAuthEnabled || locale === null) return fail("es");

  const code = url.searchParams.get("code");
  if (!code) return fail(locale);

  const profile = await fetchGoogleProfile(code);
  if (!profile) return fail(locale);

  const account = await findOrCreateAccount({
    email: profile.email,
    name: profile.name,
    locale,
  });
  await startSession(account);

  const destination = roleFor(account) === "owner" ? "office" : "account";
  return NextResponse.redirect(new URL(`/${account.locale}/${destination}`, env.siteUrl));
}
