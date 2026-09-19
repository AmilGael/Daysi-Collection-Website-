import { NextResponse } from "next/server";
import { currentViewer, type Viewer } from "@/lib/auth/session";
import { clearClientEntries, measuredCount, saveClientCard } from "@/lib/client-cards";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/security";
import { clientCardSchema } from "@/lib/validation";

/**
 * The client's own card, from their account.
 *
 * Whose card is never read from the request: it is the one matched to the
 * account the sign-in link proved (`currentViewer`), so there is no id or
 * email here for anyone to change. Origin first, as everywhere, so another
 * site cannot learn whether someone is signed in by comparing answers.
 */

const SAVES_PER_HOUR = 20;
const ONE_HOUR = 3600;

type Guard = { readonly ok: false; readonly denial: NextResponse } | { readonly ok: true; readonly viewer: Viewer };

async function guard(request: Request): Promise<Guard> {
  if (!isSameOrigin(request)) return { ok: false, denial: NextResponse.json({ error: "bad-origin" }, { status: 403 }) };
  const viewer = await currentViewer();
  if (!viewer) return { ok: false, denial: NextResponse.json({ error: "signed-out" }, { status: 401 }) };
  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "client-card"), SAVES_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return {
      ok: false,
      denial: NextResponse.json(
        { error: "rate-limited" },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
      ),
    };
  }
  return { ok: true, viewer };
}

export async function POST(request: Request) {
  const checked = await guard(request);
  if (!checked.ok) return checked.denial;

  const parsed = clientCardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    return NextResponse.json({ error: "invalid", fields }, { status: 400 });
  }

  const card = await saveClientCard(checked.viewer.account, parsed.data);
  return NextResponse.json({ saved: true, measured: measuredCount(card) });
}

/**
 * "Cleared" only when a card was found and rewritten. No card found (none
 * yet, or a file that reads as empty because a line is torn) is a 409, so
 * the form never tells a client her address is gone while it is still on
 * disk. A rewrite that cannot read the file throws, which is a 500.
 */
export async function DELETE(request: Request) {
  const checked = await guard(request);
  if (!checked.ok) return checked.denial;
  const cleared = await clearClientEntries(checked.viewer.account);
  if (!cleared) return NextResponse.json({ error: "nothing-to-clear" }, { status: 409 });
  return NextResponse.json({ cleared: true });
}
