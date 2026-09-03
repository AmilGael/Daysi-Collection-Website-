import { cache } from "react";
import { appendRecord, latestBy, readRecords } from "./records";

export type RetiredKind = "style" | "gallery" | "fabric" | "price-entry" | "request";
export type RetiredRecord = {
  readonly kind: RetiredKind;
  readonly id: string;
  readonly retired: boolean;
  readonly at: string;
};

const RETIRED = "retired";

export function retiredKey(kind: RetiredKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Memoised per render request with React `cache`: a Work render asks for
 * the request set a dozen times and the file is parsed once. Outside a
 * render (a server action, a route handler, this file's tests) `cache`
 * hands the call straight through, so a write is visible on the next read.
 * The set is shared, hence read-only.
 */
export const retiredSet = cache((kind: RetiredKind): ReadonlySet<string> => {
  const latest = latestBy(readRecords<RetiredRecord>(RETIRED), (record) =>
    retiredKey(record.kind, record.id),
  );
  return new Set(
    latest
      .filter((record) => record.kind === kind && record.retired)
      .map((record) => record.id),
  );
});

export async function setRetired(
  kind: RetiredKind,
  id: string,
  retired: boolean,
): Promise<void> {
  await appendRecord(RETIRED, { kind, id, retired, at: new Date().toISOString() } satisfies RetiredRecord);
}
