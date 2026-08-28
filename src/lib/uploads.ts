import path from "node:path";
import { env } from "./env";

/**
 * Photographs Daysi uploads from the office.
 *
 * They used to be written into `public/uploads`, which worked exactly as long
 * as the site ran on the same machine that built it. On a host, `public` is
 * inside the deployed bundle: a new deploy replaces it, and every photo she
 * had added is gone. So her uploads live beside her records instead, under
 * `.data` — one directory holding everything the running site has written,
 * which is one thing to mount a disk on and one thing to back up.
 *
 * The cost is that they are no longer served by the static file server, so
 * `/uploads/<name>` is a route handler now. That is why the guard below
 * exists: a name off the network becomes a path on disk, and the only names
 * this server will answer to are the ones it issued itself.
 */
export function uploadsDirectory(): string {
  return path.join(env.dataDirectory, "uploads");
}

/** The formats the office can store, and what to serve each one back as. */
const TYPE_FOR = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

/** `newReference("IMG")` lowercased, plus one of those formats. */
const ISSUED_NAME = /^img-[a-z0-9]{8}\.(jpg|png|webp)$/;

export type StoredUpload = { readonly file: string; readonly contentType: string };

/**
 * A stored photograph, or null for any name this server did not issue.
 *
 * Matching the whole name against the pattern is the guard: a traversal, an
 * absolute path or a nested path cannot match it, so there is no separate
 * "is it still inside the directory" check to get subtly wrong. The same match
 * settles the content type, so a file cannot be served as something it is not.
 */
export function resolveUpload(name: string): StoredUpload | null {
  const match = ISSUED_NAME.exec(name);
  if (!match) return null;
  return {
    file: path.join(uploadsDirectory(), name),
    contentType: TYPE_FOR[match[1] as keyof typeof TYPE_FOR],
  };
}
