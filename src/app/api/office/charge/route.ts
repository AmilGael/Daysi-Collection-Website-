import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ownerRoute } from "@/lib/api-guard";
import { chargeRecord } from "@/lib/office-charge";
import { chargeSchema } from "@/lib/office-validation";

/**
 * A payment link for one order, made the moment Daysi asks rather than
 * staged for Confirmar: nothing she could undo changes until the client
 * pays, and she needs the address in hand to send it. So it lives here,
 * beside the office's other immediate routes, not as a second action on the
 * Hub's draft.
 */
export const POST = ownerRoute(chargeSchema, async ({ reference, amount }) => {
  const outcome = await chargeRecord(reference, amount);
  if (!outcome.ok) {
    const status = outcome.error === "payments-off" ? 503 : outcome.error === "stripe-failed" || outcome.error === "old-link-open" ? 502 : 400;
    return NextResponse.json({ error: outcome.error }, { status });
  }
  revalidatePath("/[locale]/office", "page");
  revalidatePath("/[locale]/account/orders", "page");
  return NextResponse.json({ ok: true, link: outcome.link });
});
