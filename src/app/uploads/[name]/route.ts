import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { resolveUpload } from "@/lib/uploads";

/**
 * Serves a photograph Daysi uploaded.
 *
 * Her uploads live under `.data` rather than in `public`, so that a deploy
 * replacing the bundle cannot take them with it. That puts them outside the
 * static file server's reach, and this is what hands them back.
 *
 * `resolveUpload` is the whole security story: a name that this server did not
 * issue never becomes a path. Anything else is a 404 — the same answer a
 * genuinely missing photo gets, so probing tells an attacker nothing.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const upload = resolveUpload(name);
  if (!upload) return new NextResponse(null, { status: 404 });

  const details = await stat(upload.file).catch(() => null);
  if (!details?.isFile()) return new NextResponse(null, { status: 404 });

  const body = Readable.toWeb(createReadStream(upload.file)) as ReadableStream;

  return new NextResponse(body, {
    headers: {
      "Content-Type": upload.contentType,
      "Content-Length": String(details.size),
      // The name carries eight random characters and is never reused, so the
      // bytes behind a given URL can never change.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
