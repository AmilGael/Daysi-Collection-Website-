import { NextResponse } from "next/server";
import { env, googleAuthEnabled } from "@/lib/env";
import { beginGoogleSignIn } from "@/lib/auth/google";

/**
 * The "Continue with Google" button lands here, and this sends the browser on
 * to Google. With no OAuth client configured the button is never rendered, so
 * arriving here is someone typing the URL — they go back to the sign-in page.
 */
export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "es";

  if (!googleAuthEnabled) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, env.siteUrl));
  }

  return NextResponse.redirect(await beginGoogleSignIn(locale));
}
