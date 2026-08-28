import { NextResponse } from "next/server";
import { z } from "zod";
import { ownerRoute } from "@/lib/api-guard";
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

/** A price cannot be set on something that is not for sale. */
function unknown(what: string): NextResponse {
  return NextResponse.json({ error: `unknown-${what}` }, { status: 404 });
}

export const PUT = ownerRoute(updateSchema, async (update) => {
  if (update.kind === "entry") {
    if (!livePriceList().some((entry) => entry.id === update.id)) return unknown("entry");
    await saveEntryOverride({
      entryId: update.id,
      fixedPrice: update.fixedPrice,
      customizationExtra: update.customizationExtra,
    });
    return;
  }

  if (update.kind === "alteration") {
    if (!liveAlterations().some((alteration) => alteration.id === update.id)) {
      return unknown("alteration");
    }
    await saveAlterationOverride({
      alterationId: update.id,
      fixedPrice: update.fixedPrice,
      rushSurcharge: update.rushSurcharge,
    });
    return;
  }

  if (!liveAppointmentTypes().some((type) => type.id === update.id)) return unknown("appointment");
  await saveAppointmentOverride({ typeId: update.id, fee: update.fee });
});
