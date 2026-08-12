import { mkdir, writeFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
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
  /**
   * The account this belongs to, when there is one. Records written before
   * accounts existed have none, so "my orders" also matches on email — see
   * `requestsForAccount`.
   */
  readonly accountId?: string;
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

/** Synchronous for the reason given on `readRecords` in lib/records.ts. */
export function listRequests(kind: StoredRequestKind): StoredRequest[] {
  try {
    const contents = readFileSync(fileFor(kind), "utf8");
    return contents
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as StoredRequest);
  } catch {
    return [];
  }
}

/**
 * Everything a given account may see: their own records, and nobody else's.
 *
 * Ownership is by account id, falling back to a matching email for records
 * written before accounts existed. The email is only ever compared against the
 * *verified* address on the signed-in account — a client cannot reach another
 * person's orders by claiming their address, because claiming it is not how
 * they got here.
 */
export function requestsForAccount(
  account: { id: string; email: string },
  kinds: readonly StoredRequestKind[],
): StoredRequest[] {
  const all = kinds.flatMap(listRequests);
  const mine = all.filter(
    (record) =>
      record.accountId === account.id ||
      (record.accountId === undefined &&
        record.client.email.trim().toLowerCase() === account.email),
  );

  return currentRecords(mine).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/**
 * The store is append-only, so one reference can appear several times as its
 * status changes. The newest line is the current truth.
 */
export function currentRecords(records: readonly StoredRequest[]): StoredRequest[] {
  const latest = new Map<string, StoredRequest>();
  for (const record of records) latest.set(record.reference, record);
  return [...latest.values()];
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
