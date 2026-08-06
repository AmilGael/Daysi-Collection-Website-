import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { Estimate } from "./pricing";

/**
 * ERD: REQUEST. Where a submitted request lives once it has been validated.
 *
 * This writes newline-delimited JSON to a gitignored folder with owner-only
 * permissions. It is the seam that a real database or Daysi's CMS slots into:
 * the pages and route handlers only ever call `saveRequest` and `listRequests`,
 * so swapping the storage behind them touches this file alone.
 *
 * Client photographs are written next to the record rather than inlined, so the
 * index stays small and an image can be deleted on its own.
 */

const DATA_DIRECTORY = path.join(process.cwd(), ".data");
const OWNER_ONLY_DIRECTORY = 0o700;
const OWNER_ONLY_FILE = 0o600;

export type StoredRequestKind = "alteration" | "order" | "commission" | "appointment" | "contact" | "premiere-signup";

export type StoredRequest = {
  readonly reference: string;
  readonly kind: StoredRequestKind;
  readonly submittedAt: string;
  readonly locale: "es" | "en";
  readonly client: {
    readonly name: string;
    readonly email: string;
    readonly phone?: string;
    readonly preferredContact?: "whatsapp" | "phone" | "email";
  };
  readonly details: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  readonly estimate?: Estimate;
  readonly photoFile?: string;
  status: "new" | "answered" | "scheduled" | "paid" | "closed";
};

async function ensureDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: OWNER_ONLY_DIRECTORY });
}

function fileFor(kind: StoredRequestKind): string {
  return path.join(DATA_DIRECTORY, `${kind}.jsonl`);
}

export async function saveRequest(request: StoredRequest): Promise<void> {
  await ensureDirectory(DATA_DIRECTORY);
  await writeFile(fileFor(request.kind), `${JSON.stringify(request)}\n`, {
    encoding: "utf8",
    flag: "a",
    mode: OWNER_ONLY_FILE,
  });
}

export async function saveRequestPhoto(
  reference: string,
  mime: string,
  bytes: Uint8Array,
): Promise<string> {
  const photoDirectory = path.join(DATA_DIRECTORY, "photos");
  await ensureDirectory(photoDirectory);
  const extension = mime.split("/")[1] ?? "bin";
  const filename = `${reference}.${extension}`;
  await writeFile(path.join(photoDirectory, filename), bytes, { mode: OWNER_ONLY_FILE });
  return filename;
}

export async function listRequests(kind: StoredRequestKind): Promise<StoredRequest[]> {
  try {
    const contents = await readFile(fileFor(kind), "utf8");
    return contents
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as StoredRequest);
  } catch {
    return [];
  }
}

/** Every kind that currently has anything stored. Used by the owner inbox. */
export async function storedKinds(): Promise<StoredRequestKind[]> {
  try {
    const entries = await readdir(DATA_DIRECTORY);
    return entries
      .filter((entry) => entry.endsWith(".jsonl"))
      .map((entry) => entry.replace(".jsonl", "") as StoredRequestKind);
  } catch {
    return [];
  }
}
