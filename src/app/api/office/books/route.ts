import { NextResponse } from "next/server";
import { z } from "zod";
import { invalid, ownerRequest } from "@/lib/api-guard";
import { loadLedger } from "@/lib/earnings";
import { exportFilename, salesCsv } from "@/lib/books";

/**
 * Hands back the sales file for a date range. Owner-only, and a 404 rather
 * than a 403 for anyone else — this is every client's name, email and amount
 * in one download, so it does not even confirm it exists. That rule is
 * lib/api-guard's now; the range is this route's own, because it arrives on
 * the query string rather than in a body.
 */

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locale: z.enum(["en", "es"]).default("en"),
});

export const GET = ownerRequest(async (request) => {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    locale: url.searchParams.get("locale") ?? "en",
  });
  if (!parsed.success || parsed.data.from > parsed.data.to) return invalid();

  const { from, to, locale } = parsed.data;
  // The BOM is what makes Excel open a UTF-8 file with "Medallón" intact.
  const csv = `\uFEFF${salesCsv(loadLedger(), locale, from, to)}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(from, to)}"`,
      "Cache-Control": "no-store",
    },
  });
});
