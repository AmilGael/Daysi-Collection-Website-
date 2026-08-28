import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSameOrigin } from "@/lib/security";
import { currentViewer } from "@/lib/auth/session";
import { saveNotice } from "@/lib/live-catalog";

/**
 * The atelier notice — one short line Daysi can hang on the site herself:
 * "Away until the 30th, orders resume after." Turning it off is a new record
 * with visible false, so the last wording survives for re-use.
 */

const noticeSchema = z.object({
  message: z.string().trim().max(200),
  visible: z.boolean(),
});

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "owner") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const parsed = noticeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  await saveNotice(parsed.data);
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
