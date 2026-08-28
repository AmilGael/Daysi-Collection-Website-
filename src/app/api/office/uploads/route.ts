import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { isSameOrigin, newReference } from "@/lib/security";
import { currentViewer } from "@/lib/auth/session";
import { uploadsDirectory } from "@/lib/uploads";

/**
 * Where Daysi drops a photograph: a new shot of a piece, or the swatch of a
 * fabric she has just brought into the atelier. Files land under `.data`
 * beside her records under a server-chosen name — the browser's filename never
 * touches the disk — and the caller gets back the path to reference from an
 * override or a fabric record. They are served back by `app/uploads/[name]`.
 */

const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSION_FOR: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "owner") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const extension = EXTENSION_FOR[file.type];
  if (!extension) {
    return NextResponse.json({ error: "unsupported-type" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too-large" }, { status: 400 });
  }

  const name = `${newReference("IMG").toLowerCase()}.${extension}`;
  const directory = uploadsDirectory();
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, name),
    new Uint8Array(await file.arrayBuffer()),
  );

  return NextResponse.json({ src: `/uploads/${name}` });
}
