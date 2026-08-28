import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/security";
import { currentViewer } from "@/lib/auth/session";
import { currentRecords, listRequests, saveRequest } from "@/lib/request-store";

/**
 * Daysi moves a request through its life from the office: answered, scheduled,
 * paid, closed. The store is append-only, so an update is a fresh line with
 * the new status and the old lines remain as the record's history.
 *
 * A caller who is not the signed-in owner gets a 404, the same nothing the
 * office page itself gives — not a 403 that confirms there is an office.
 */

const updateSchema = z.object({
  kind: z.enum(["alteration", "order", "commission", "appointment", "contact", "premiere-signup"]),
  reference: z.string().trim().min(1).max(40),
  status: z.enum(["new", "answered", "scheduled", "paid", "closed"]),
});

export async function PATCH(request: Request) {
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

  const { kind, reference, status } = parsed.data;
  const record = currentRecords(listRequests(kind)).find(
    (candidate) => candidate.reference === reference,
  );
  if (!record) {
    return NextResponse.json({ error: "unknown-reference" }, { status: 404 });
  }
  if (record.status === status) {
    return NextResponse.json({ reference, status });
  }

  await saveRequest({ ...record, status });
  return NextResponse.json({ reference, status });
}
