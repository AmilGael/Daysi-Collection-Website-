import { NextResponse } from "next/server";
import { ownerRequest } from "@/lib/api-guard";
import { readManual } from "@/lib/office-helper";

/**
 * The manual itself, for "Abrir el manual" — opened in a new tab, which is
 * why `ownerRequest` rather than `ownerRoute` is enough here: a plain link
 * carries no body, and the office page it comes from is the Referer that
 * satisfies the same-origin check (see photos/[reference]/route.ts).
 *
 * A missing file is a 404 rather than an error: the helper still answers
 * from the live state alone (`office-helper.ts`), and this link simply has
 * nothing to open.
 */
export const GET = ownerRequest(async () => {
  const html = readManual();
  if (!html) return new NextResponse(null, { status: 404 });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
