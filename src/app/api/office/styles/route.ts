import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { styles } from "@/content";
import { isSameOrigin } from "@/lib/security";
import { currentViewer } from "@/lib/auth/session";
import { saveStyleOverride } from "@/lib/live-catalog";

/**
 * The collection, managed from the office: show or hide a piece, and set
 * which sizes are on the rack today. Writes an override record; the static
 * catalog in `content/styles.ts` is never edited from here.
 */

const overrideSchema = z.object({
  styleId: z.enum(styles.map((style) => style.id) as [string, ...string[]]),
  isPublished: z.boolean(),
  stock: z
    .object({ s: z.boolean().optional(), m: z.boolean().optional(), l: z.boolean().optional() })
    .strict(),
  addedPhotos: z
    .array(z.string().regex(/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/))
    .max(12)
    .optional(),
  coverSrc: z.string().max(200).optional(),
});

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "owner") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const parsed = overrideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  await saveStyleOverride(parsed.data);

  // The gallery, the style's own page and the home lookbook all read the
  // merged catalog; statically rendered copies are stale the moment this lands.
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
