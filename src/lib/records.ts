import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { env } from "./env";

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

export const dataDirectory = DATA_DIRECTORY;
export const ownerOnlyFileMode = OWNER_ONLY_FILE;
export const ownerOnlyDirectoryMode = OWNER_ONLY_DIRECTORY;
