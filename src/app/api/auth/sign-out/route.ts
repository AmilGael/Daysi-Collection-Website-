import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/security";
import { endSession } from "@/lib/auth/session";

/**
 * Signing out is a POST on purpose: a GET would let any page on the internet
 * sign a client out by embedding an image.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  await endSession();
  return NextResponse.json({ signedOut: true });
}
