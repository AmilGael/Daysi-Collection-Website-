import { appendRecord, latestBy, readRecords } from "./records";

export type RetiredKind = "style" | "gallery";
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

export function retiredSet(kind: RetiredKind): Set<string> {
  const latest = latestBy(readRecords<RetiredRecord>(RETIRED), (record) =>
    retiredKey(record.kind, record.id),
  );
  return new Set(
    latest
      .filter((record) => record.kind === kind && record.retired)
      .map((record) => record.id),
  );
}

export async function setRetired(
  kind: RetiredKind,
  id: string,
  retired: boolean,
): Promise<void> {
  await appendRecord(RETIRED, { kind, id, retired, at: new Date().toISOString() } satisfies RetiredRecord);
}
