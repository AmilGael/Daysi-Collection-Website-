import { describe, expect, it } from "vitest";
import { callerKey, checkRateLimit } from "./rate-limit";

function headers(values: Record<string, string>): { get(name: string): string | null } {
  const lower = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name) => lower.get(name.toLowerCase()) ?? null };
}

describe("callerKey", () => {
  it("prefers fly-client-ip over X-Forwarded-For", () => {
    const request = { headers: headers({ "fly-client-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1, 203.0.113.9" }) };
    expect(callerKey(request, "help")).toBe("help:203.0.113.9");
  });

  it("falls back to the rightmost X-Forwarded-For entry when there is no fly-client-ip", () => {
    const request = { headers: headers({ "x-forwarded-for": "198.51.100.1, 172.16.0.4, 203.0.113.9" }) };
    expect(callerKey(request, "help")).toBe("help:203.0.113.9");
  });

  it("falls back to a constant when neither header is present", () => {
    const request = { headers: headers({}) };
    expect(callerKey(request, "help")).toBe("help:local");
  });

  it("cannot be reset by a spoofed leftmost X-Forwarded-For entry, since only the rightmost one is trusted", () => {
    const first = callerKey({ headers: headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }) }, "help");
    const second = callerKey({ headers: headers({ "x-forwarded-for": "2.2.2.2, 203.0.113.9" }) }, "help");
    expect(first).toBe(second);

    checkRateLimit(first, 1, 3600);
    expect(checkRateLimit(second, 1, 3600).allowed).toBe(false);
  });
});
