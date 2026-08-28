import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { styleCreateSchema, styleOverrideSchema } from "@/lib/office-validation";
import { isSameOrigin, newReference } from "@/lib/security";
import { currentViewer } from "@/lib/auth/session";
import { allLiveStyles, saveAddedStyle, saveStyleOverride } from "@/lib/live-catalog";
import { liveFabrics, livePriceList, saveCustomEntry } from "@/lib/live-pricing";

/**
 * The collection, managed from the office: show or hide a piece, and set
 * which sizes are on the rack today. Writes an override record; the static
 * catalog in `content/styles.ts` is never edited from here.
 */


export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "owner") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const parsed = styleOverrideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (!allLiveStyles().some((style) => style.id === parsed.data.styleId)) {
    return NextResponse.json({ error: "unknown-style" }, { status: 404 });
  }

  await saveStyleOverride(parsed.data);

  // The gallery, the style's own page and the home lookbook all read the
  // merged catalog; statically rendered copies are stale the moment this lands.
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}


/**
 * A garment Daysi has made and wants on the site — the piece of her own
 * upkeep that used to need a developer.
 *
 * She names it, says what it is, files it under a garment and a cloth, marks
 * the sizes she has, and attaches the photographs. The price comes from the
 * published list when that garment and cloth are already priced; when they are
 * not, the figure she gives here becomes the published price for the pair.
 */

/** "Frutera two-piece" -> "frutera-two-piece", and never an empty slug. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "owner") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const parsed = styleCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const draft = parsed.data;

  if (!liveFabrics().some((fabric) => fabric.id === draft.fabricId)) {
    return NextResponse.json({ error: "unknown-fabric" }, { status: 400 });
  }
  if (!Object.values(draft.sizes).some(Boolean)) {
    return NextResponse.json({ error: "no-sizes" }, { status: 400 });
  }

  const priceEntryId = `${draft.categoryId}--${draft.fabricId}`;
  const existing = livePriceList().find((entry) => entry.id === priceEntryId);
  if (!existing) {
    if (draft.fixedPrice === undefined || draft.fixedPrice <= 0) {
      return NextResponse.json({ error: "price-required" }, { status: 400 });
    }
    await saveCustomEntry({
      id: priceEntryId,
      categoryId: draft.categoryId,
      fabricId: draft.fabricId,
      fixedPrice: draft.fixedPrice,
      customizationExtra: CUSTOMIZATION_EXTRA[draft.categoryId] ?? 9500,
      customizationNote: {
        en: "Made to your measurements, with your choice of neckline, sleeve and length.",
        es: "Hecho a su medida, con el escote, la manga y el largo que usted elija.",
      },
      effectiveDate: new Date().toISOString().slice(0, 10),
    });
  }

  // Two garments named alike would otherwise fight over one URL, and the
  // detail page would only ever show whichever came first.
  const taken = new Set(allLiveStyles().map((style) => style.slug));
  const base = slugify(draft.name) || newReference("STY").toLowerCase();
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;

  await saveAddedStyle({
    id: newReference("STY").toLowerCase(),
    slug,
    name: { en: draft.name, es: draft.name },
    categoryId: draft.categoryId,
    priceEntryId,
    color: { en: draft.color, es: draft.color },
    description: { en: draft.description, es: draft.description },
    detail: { en: draft.detail, es: draft.detail },
    sizes: (["s", "m", "l"] as const).map((sizeId) => ({
      sizeId,
      inStock: draft.sizes[sizeId],
    })),
    photos: draft.photos.map((src, index) => ({
      src,
      alt: { en: draft.name, es: draft.name },
      isPrimary: index === 0,
    })),
    customizationAvailable: true,
    isPublished: true,
  });

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, slug });
}

/** Matches the coded per-category charge so her pieces price like the rest. */
const CUSTOMIZATION_EXTRA: Record<string, number> = {
  dresses: 9500,
  pants: 6500,
  shirts: 5500,
  heritage: 12000,
};
