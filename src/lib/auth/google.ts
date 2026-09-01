import { cookies } from "next/headers";
import { env, isProduction } from "../env";
import { hashToken, hashesMatch, newToken } from "./accounts";

/**
 * "Continue with Google", by the standard authorization-code flow and nothing
 * more. No library: the flow is two redirects and two fetches, and a
 * dependency here would be a second implementation of `fetch`.
 *
 * The state parameter is a random token whose hash rides in a short-lived
 * cookie, so a callback forged from elsewhere fails the same way a forged
 * session cookie does. Only the email comes back out — accounts here are an
 * address, and Google is just a second way to prove one. A Google account
 * whose address is on OWNER_EMAIL is Daysi, by the same rule as always.
 */

const STATE_COOKIE = "daysi_oauth_state";
const STATE_MINUTES = 10;

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function googleRedirectUri(): string {
  return `${env.siteUrl}/api/auth/google/callback`;
}

/**
 * Builds the URL the sign-in button sends the browser to, and parks the state
 * (and the locale, which must survive the round trip) in the cookie jar.
 */
export async function beginGoogleSignIn(locale: "es" | "en"): Promise<string> {
  const state = newToken();

  const jar = await cookies();
  jar.set(STATE_COOKIE, `${hashToken(state)}.${locale}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: STATE_MINUTES * 60,
  });

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", env.googleClientId ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Verifies the state that came back against the cookie, consuming the cookie
 * either way. Returns the locale the flow started in, or null for a state
 * that proves nothing.
 */
export async function consumeGoogleState(state: string): Promise<"es" | "en" | null> {
  const jar = await cookies();
  const stored = jar.get(STATE_COOKIE)?.value ?? "";
  jar.delete(STATE_COOKIE);

  const [storedHash, locale] = stored.split(".");
  if (!state || !storedHash || !hashesMatch(hashToken(state), storedHash)) return null;
  return locale === "en" ? "en" : "es";
}

/**
 * Trades the code for tokens and reads the verified profile. Null on any
 * failure — the caller treats every failure identically, as a bad link.
 */
export async function fetchGoogleProfile(
  code: string,
): Promise<{ email: string; name: string } | null> {
  if (!env.googleClientId || !env.googleClientSecret) return null;

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  }).catch(() => null);
  if (!tokenResponse?.ok) return null;

  const tokens = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
  } | null;
  if (!tokens?.access_token) return null;

  const profileResponse = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  }).catch(() => null);
  if (!profileResponse?.ok) return null;

  const profile = (await profileResponse.json().catch(() => null)) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  } | null;

  // An unverified address proves nothing about who is asking.
  if (!profile?.email || profile.email_verified !== true) return null;
  return { email: profile.email, name: profile.name ?? "" };
}
