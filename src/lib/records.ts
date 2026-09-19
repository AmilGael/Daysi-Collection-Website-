import { mkdir, rename, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { env } from "./env";
import { sign, verify } from "./signing";

/**
 * The append-only, newline-delimited JSON store everything on this site is
 * kept in, factored out so accounts, sessions and requests all share one set
 * of rules rather than three near-copies.
 *
 * Append-only is deliberate: a record is never edited in place, so a status
 * change is a new line and the file is its own history. `latestBy` is how a
 * reader collapses that history down to the current truth — it is what lets a
 * cancelled booking free its slot and a paid order stop showing as unpaid.
 *
 * This is the seam a real database slots into. Callers only ever append and
 * read, so replacing the two functions below is the whole migration.
 */

const DATA_DIRECTORY = env.dataDirectory;
const OWNER_ONLY_DIRECTORY = 0o700;
const OWNER_ONLY_FILE = 0o600;

export async function appendRecord(collection: string, record: unknown): Promise<void> {
  await mkdir(DATA_DIRECTORY, { recursive: true, mode: OWNER_ONLY_DIRECTORY });
  await writeFile(path.join(DATA_DIRECTORY, `${collection}.jsonl`), `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
    mode: OWNER_ONLY_FILE,
  });
}

/**
 * Reads a collection.
 *
 * The read is synchronous on purpose. React's development build records the
 * value of everything a Server Component awaits so its debugger can show it,
 * and it puts those values in the payload sent to the browser — which for an
 * awaited `readFile` means the whole file. On the account page that is one
 * client's session hashes and another client's order landing in a third
 * client's HTML. Production strips the instrumentation, but a demo laptop
 * pointed at real data would not.
 *
 * A synchronous read has no awaited value to record. These are small local
 * files on the same disk as the process, so the cost is a rounding error next
 * to the render itself — and when this moves to a database, that call is
 * genuinely async and carries no file contents to leak.
 */
export function readRecords<T>(collection: string): T[] {
  try {
    const contents = readFileSync(path.join(DATA_DIRECTORY, `${collection}.jsonl`), "utf8");
    return contents
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

/**
 * The newest record per key, in file order. Later lines win, which is what
 * makes an append an update.
 */
export function latestBy<T>(records: readonly T[], key: (record: T) => string): T[] {
  const latest = new Map<string, T>();
  for (const record of records) latest.set(key(record), record);
  return [...latest.values()];
}

/** Every line for one key, in file order: the record's own history. */
export function versionsOf<T>(
  collection: string,
  key: (record: T) => string,
  id: string,
): T[] {
  return readRecords<T>(collection).filter((record) => key(record) === id);
}

/** The line before the newest one, or undefined when there is none. */
export function previousVersion<T>(
  collection: string,
  key: (record: T) => string,
  id: string,
): T | undefined {
  return versionsOf(collection, key, id).at(-2);
}

/**
 * Rewrites a collection keeping only the lines `keep` accepts.
 *
 * Every other write here appends, so history is never lost by accident. This
 * is the one deliberate exception: a client who clears their card is owed an
 * erasure, not a newer blank line with the old address still underneath. The
 * kept lines go to a temporary file beside the collection, renamed over it,
 * so a crash mid-write leaves the old file whole. Each kept line is copied
 * as it was, not re-serialised.
 *
 * It reads the file itself, strictly (`readForRewrite`), never through
 * `readRecords`: that one reads anything it cannot read as empty, which is
 * right for a page and ruinous here, where "empty" means "write an empty
 * book". On any doubt it throws and the file is left exactly as it was.
 *
 * The caller must hold the collection's own lock: an append landing between
 * the read and the rename would be lost.
 */
export async function rewriteRecords<T>(
  collection: string,
  keep: (record: T) => boolean,
): Promise<void> {
  await mkdir(DATA_DIRECTORY, { recursive: true, mode: OWNER_ONLY_DIRECTORY });
  const file = path.join(DATA_DIRECTORY, `${collection}.jsonl`);
  const kept = readForRewrite<T>(collection, file).filter(({ record }) => keep(record));
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, kept.map(({ line }) => `${line}\n`).join(""), {
    encoding: "utf8",
    mode: OWNER_ONLY_FILE,
  });
  await rename(temporary, file);
}

/**
 * Every line of a collection with its record, or an error: a missing file is
 * an empty collection, and anything else it cannot account for (a read that
 * fails for any other reason, a line that is not a JSON object, a file with
 * something in it that yields no records) refuses the rewrite.
 */
function readForRewrite<T>(collection: string, file: string): { line: string; record: T }[] {
  let contents: string;
  try {
    contents = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const lines: { line: string; record: T }[] = [];
  contents.split("\n").forEach((line, index) => {
    if (line.trim().length === 0) return;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      throw new Error(`[records] ${collection}: line ${index + 1} is not JSON; refusing to rewrite.`);
    }
    if (typeof record !== "object" || record === null || Array.isArray(record)) {
      throw new Error(`[records] ${collection}: line ${index + 1} is not a record; refusing to rewrite.`);
    }
    lines.push({ line, record: record as T });
  });
  if (lines.length === 0 && contents.trim().length > 0) {
    throw new Error(`[records] ${collection}: the file is not empty but holds no records; refusing to rewrite.`);
  }
  return lines;
}

/**
 * Signed records.
 *
 * A line on the volume proves nothing on its own: anyone who can write to the
 * disk can append one, and code execution as the server's user is enough to
 * write to the disk. Sessions and sign-in links therefore carry an HMAC over
 * their own contents under AUTH_SECRET, which exists only in the process
 * environment. A planted line has no valid signature and is ignored, so a
 * foothold on the machine cannot be turned into a login that survives it.
 */
const warnedCollections = new Set<string>();

function canonical(record: Record<string, unknown>): string {
  const keys = Object.keys(record)
    .filter((key) => key !== "sig")
    .sort();
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, record[key]])));
}

export async function appendSignedRecord(
  collection: string,
  record: Record<string, unknown>,
): Promise<void> {
  const { sig: _previous, ...body } = record;
  await appendRecord(collection, { ...body, sig: sign(canonical(body)) });
}

export function readSignedRecords<T extends Record<string, unknown>>(collection: string): T[] {
  const kept: T[] = [];
  let dropped = 0;
  for (const line of readRecords<Record<string, unknown>>(collection)) {
    const { sig, ...body } = line;
    if (typeof sig === "string" && verify(canonical(body), sig)) kept.push(body as T);
    else dropped += 1;
  }
  if (dropped > 0 && !warnedCollections.has(collection)) {
    warnedCollections.add(collection);
    console.warn(`[records] ${collection}: ignoring ${dropped} unsigned or tampered line(s).`);
  }
  return kept;
}

export const dataDirectory = DATA_DIRECTORY;
export const ownerOnlyFileMode = OWNER_ONLY_FILE;
export const ownerOnlyDirectoryMode = OWNER_ONLY_DIRECTORY;
