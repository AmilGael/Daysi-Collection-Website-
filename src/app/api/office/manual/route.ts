import { NextResponse } from "next/server";
import { ownerRequest } from "@/lib/api-guard";
import { readManual } from "@/lib/manual";

/**
 * The manual's raw file. Nothing links here any more: "Abrir el manual" now
 * opens `/office/manual`, which shows the manual inside the office in the
 * site's own type. This stays for anyone who kept the old address, and the
 * file no longer carries styling, so it arrives as plain HTML.
 *
 * `ownerRequest` rather than `ownerRoute` is enough: a plain link carries no
 * body, and the office page it comes from is the Referer that satisfies the
 * same-origin check (see photos/[reference]/route.ts).
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
