import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fabrics } from "@/content";
import { isSameOrigin } from "@/lib/security";
import { currentViewer } from "@/lib/auth/session";
import { customFabrics, saveCustomFabric } from "@/lib/live-pricing";

/**
 * A fabric Daysi has brought into the atelier: a name, the swatch she just
 * photographed, and what a piece in it costs per garment category. It joins
 * the design studio's fabric wall and the price list the moment it saves.
 */

const cents = z.number().int().min(1_00).max(5_000_00);

const fabricSchema = z.object({
  name: z.string().trim().min(2).max(40),
  swatchImage: z.string().regex(/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/),
  averageColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  prices: z
    .object({
      dresses: cents.optional(),
      pants: cents.optional(),
      shirts: cents.optional(),
      heritage: cents.optional(),
    })
    .strict()
    .refine((prices) => Object.keys(prices).length > 0, "at least one category"),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "owner") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const parsed = fabricSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const taken = new Set([
    ...fabrics.map((fabric) => fabric.id),
    ...customFabrics().map((fabric) => fabric.id),
  ]);
  let id = slugify(parsed.data.name);
  if (id.length < 2) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  while (taken.has(id)) id = `${id}-2`;

  await saveCustomFabric({ id, ...parsed.data });
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, id });
}
