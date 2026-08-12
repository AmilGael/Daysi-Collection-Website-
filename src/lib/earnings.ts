import type { Cents } from "@/content";
import { currentRecords, listRequests, type StoredRequest } from "./request-store";

/**
 * What Daysi has actually earned, and what is still owed to her.
 *
 * Two numbers matter and they are not the same one: money that has cleared,
 * and money that is promised. A dashboard that adds them together tells a
 * seamstress she can pay rent with an estimate.
 */

export type Earnings = {
  /** Cleared through the payment provider. */
  readonly received: Cents;
  /** Agreed, work in progress, not yet paid. */
  readonly outstanding: Cents;
  readonly paidCount: number;
  readonly openCount: number;
};

const BILLABLE = ["order", "alteration", "commission", "appointment"] as const;

export function loadLedger(): StoredRequest[] {
  const all = BILLABLE.flatMap(listRequests);
  return currentRecords(all).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function earningsFrom(records: readonly StoredRequest[]): Earnings {
  let received = 0;
  let outstanding = 0;
  let paidCount = 0;
  let openCount = 0;

  for (const record of records) {
    const total = record.estimate?.total ?? 0;
    if (total === 0) continue;

    if (record.status === "paid") {
      received += total;
      paidCount += 1;
    } else if (record.status !== "closed") {
      outstanding += total;
      openCount += 1;
    }
  }

  return { received, outstanding, paidCount, openCount };
}

/** Cleared earnings per calendar month, oldest first, for the trend strip. */
export function monthlyReceived(
  records: readonly StoredRequest[],
  months: number,
  now: Date,
): { month: string; total: Cents }[] {
  const buckets = new Map<string, Cents>();

  for (let back = months - 1; back >= 0; back -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
    buckets.set(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, 0);
  }

  for (const record of records) {
    if (record.status !== "paid") continue;
    const month = record.submittedAt.slice(0, 7);
    if (!buckets.has(month)) continue;
    buckets.set(month, (buckets.get(month) ?? 0) + (record.estimate?.total ?? 0));
  }

  return [...buckets.entries()].map(([month, total]) => ({ month, total }));
}
