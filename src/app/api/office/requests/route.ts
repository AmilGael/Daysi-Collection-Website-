import { NextResponse } from "next/server";
import { z } from "zod";
import { ownerRoute } from "@/lib/api-guard";
import { currentRecords, listRequests, saveRequest } from "@/lib/request-store";

/**
 * Daysi moves a request through its life from the office: answered, scheduled,
 * paid, closed. The store is append-only, so an update is a fresh line with
 * the new status and the old lines remain as the record's history.
 *
 * A caller who is not the signed-in owner gets a 404, the same nothing the
 * office page itself gives — not a 403 that confirms there is an office. That
 * rule now lives in lib/api-guard rather than in each route.
 */

const updateSchema = z.object({
  kind: z.enum(["alteration", "order", "commission", "appointment", "contact", "premiere-signup"]),
  reference: z.string().trim().min(1).max(40),
  status: z.enum(["new", "answered", "scheduled", "paid", "closed"]),
});

export const PATCH = ownerRoute(updateSchema, async ({ kind, reference, status }) => {
  const record = currentRecords(listRequests(kind)).find(
    (candidate) => candidate.reference === reference,
  );
  if (!record) {
    return NextResponse.json({ error: "unknown-reference" }, { status: 404 });
  }
  // Already there. Saying so is cheaper than writing a line that changes
  // nothing to a file that is its own history.
  if (record.status !== status) await saveRequest({ ...record, status });

  return NextResponse.json({ reference, status });
});
