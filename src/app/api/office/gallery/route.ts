import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSameOrigin, newReference } from "@/lib/security";
import { currentViewer } from "@/lib/auth/session";
import { addGalleryWork, setGalleryVisibility } from "@/lib/live-gallery";

/**
 * Daysi's own additions to the portfolio. She uploads the photograph first
 * (see /api/office/uploads), then posts what it is.
 *
 * The intrinsic size comes from the browser because the layout needs it to
 * hold the space before the file arrives. It is bounded rather than trusted —
 * it decides how tall a box is, never what anything costs.
 */

const addSchema = z.object({
  src: z.string().regex(/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/),
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  category: z.enum(["runway", "commissions", "bridal", "accessories", "press", "workroom"]),
  caption: z.string().trim().max(200),
});

const visibilitySchema = z.object({
  id: z.string().trim().min(1).max(60),
  hidden: z.boolean(),
});

async function requireOwner() {
  const viewer = await currentViewer();
  return viewer && viewer.role === "owner" ? viewer : null;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { caption, ...rest } = parsed.data;
  await addGalleryWork({
    id: newReference("GAL").toLowerCase(),
    ...rest,
    // One caption in her own words, shown in both languages. Asking her to
    // write every line twice is how a gallery stops getting updated.
    caption: { en: caption, es: caption },
  });

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const parsed = visibilitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  await setGalleryVisibility(parsed.data.id, parsed.data.hidden);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
