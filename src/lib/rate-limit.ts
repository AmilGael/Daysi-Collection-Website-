/**
 * A fixed-window limiter held in memory. It is deliberately simple: this site
 * runs as a single small instance, and the job here is to stop one script from
 * filling Daysi's inbox, not to survive a distributed attack.
 *
 * Moving to a shared store later means replacing `hits` and nothing else.
 */

type Window = { count: number; resetsAt: number };

const hits = new Map<string, Window>();

export type RateLimit = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimit {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = hits.get(key);

  if (!existing || existing.resetsAt <= now) {
    hits.set(key, { count: 1, resetsAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.ceil((existing.resetsAt - now) / 1000);

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds };
}

/**
 * The best available identifier for the caller. Behind Vercel this is the real
 * client address; locally it falls back to a constant, which is fine because
 * there is only ever one caller.
 */
export function callerKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim() ?? "local";
  return `${scope}:${address}`;
}

/** Drops windows that have already expired, so the map cannot grow forever. */
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [key, window] of hits) {
    if (window.resetsAt <= now) hits.delete(key);
  }
}
