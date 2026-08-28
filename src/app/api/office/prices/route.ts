import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSameOrigin } from "@/lib/security";
import { currentViewer } from "@/lib/auth/session";
import {
  liveAlterations,
  liveAppointmentTypes,
  livePriceList,
  saveAlterationOverride,
  saveAppointmentOverride,
  saveEntryOverride,
} from "@/lib/live-pricing";

/**
 * Daysi edits the price list. One override per save, validated against the ids
 * that actually exist, capped so a slipped keystroke cannot publish a $50,000
 * hem. The static list in content/ is never edited; see lib/live-pricing.
 */

const cents = z.number().int().min(0).max(5_000_00);

const updateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("entry"), id: z.string().max(80), fixedPrice: cents, customizationExtra: cents }),
  z.object({ kind: z.literal("alteration"), id: z.string().max(80), fixedPrice: cents, rushSurcharge: cents }),
  z.object({ kind: z.literal("appointment"), id: z.string().max(80), fee: cents }),
]);

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "owner") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const update = parsed.data;
  if (update.kind === "entry") {
    if (!livePriceList().some((entry) => entry.id === update.id)) {
      return NextResponse.json({ error: "unknown-entry" }, { status: 404 });
    }
    await saveEntryOverride({
      entryId: update.id,
      fixedPrice: update.fixedPrice,
      customizationExtra: update.customizationExtra,
    });
  } else if (update.kind === "alteration") {
    if (!liveAlterations().some((alteration) => alteration.id === update.id)) {
      return NextResponse.json({ error: "unknown-alteration" }, { status: 404 });
    }
    await saveAlterationOverride({
      alterationId: update.id,
      fixedPrice: update.fixedPrice,
      rushSurcharge: update.rushSurcharge,
    });
  } else {
    if (!liveAppointmentTypes().some((type) => type.id === update.id)) {
      return NextResponse.json({ error: "unknown-appointment" }, { status: 404 });
    }
    await saveAppointmentOverride({ typeId: update.id, fee: update.fee });
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
