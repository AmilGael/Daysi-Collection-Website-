import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { ownerRequest } from "@/lib/api-guard";
import { resolveRequestPhoto } from "@/lib/request-store";

/**
 * The photo a client sent with a request — a design's mockup from the studio,
 * a snapshot of a garment with an alteration — for the Hub's thumbnail and
 * the full picture behind it.
 *
 * Unlike `/uploads`, these are a client's own pictures, so the owner guard
 * stands in front and nothing is cached on the way: a stranger is told the
 * address does not exist, the same 404 a missing photo gets.
 * `resolveRequestPhoto` is the path story: the reference only ever selects a
 * record, and the file is the one this server named for it.
 *
 * The guard checks the request came from this site, which an `<img>` or a
 * link in the office satisfies by its Referer. A link to this route must not
 * carry `rel="noreferrer"`, or it arrives with neither header and is refused.
 */

type Context = { params: Promise<{ reference: string }> };

export const GET = ownerRequest<Context>(async (_request, { params }) => {
  const { reference } = await params;
  const photo = resolveRequestPhoto(reference);
  if (!photo) return new NextResponse(null, { status: 404 });

  const details = await stat(photo.file).catch(() => null);
  if (!details?.isFile()) return new NextResponse(null, { status: 404 });

  const body = Readable.toWeb(createReadStream(photo.file)) as ReadableStream;

  return new NextResponse(body, {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Length": String(details.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
