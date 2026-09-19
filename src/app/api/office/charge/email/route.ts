import { NextResponse } from "next/server";
import { ownerRoute } from "@/lib/api-guard";
import { emailPaymentLink } from "@/lib/office-charge";
import { sendLinkSchema } from "@/lib/office-validation";

/** Emails an order's open payment link to its client. Writes nothing. */
export const POST = ownerRoute(sendLinkSchema, async ({ reference }) => {
  const outcome = await emailPaymentLink(reference);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.error === "email-failed" ? 502 : 400 });
  }
  return NextResponse.json({ ok: true });
});
