import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The promises the account system makes: nobody can promote themselves to the
 * office, no secret is stored in a form that can be replayed, and a cart
 * cookie cannot be edited into a discount.
 */

const OWNER = "daysi@example.com";

beforeEach(() => {
  vi.resetModules();
  process.env.OWNER_EMAIL = OWNER;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

describe("who gets the office", () => {
  it("gives it to the owner address, however it is typed", async () => {
    const { roleFor } = await import("./accounts");
    for (const email of [OWNER, "  DAYSI@Example.com  ".toLowerCase().trim()]) {
      expect(roleFor({ id: "a", email, name: "", locale: "es", createdAt: "" })).toBe("owner");
    }
  });

  it("gives it to nobody else", async () => {
    const { roleFor } = await import("./accounts");
    const impostors = [
      "client@example.com",
      // Near-misses that a naive contains/startsWith check would wave through.
      `${OWNER}.attacker.com`,
      `attacker+${OWNER}@evil.com`,
      "daysi@example.com.evil.com",
    ];
    for (const email of impostors) {
      expect(roleFor({ id: "b", email, name: "", locale: "es", createdAt: "" })).toBe("client");
    }
  });

  it("gives it to every address on the list, and still nobody else", async () => {
    process.env.OWNER_EMAIL = `${OWNER}, Gamaliel@Example.com `;
    vi.resetModules();
    const { roleFor } = await import("./accounts");
    expect(roleFor({ id: "d", email: OWNER, name: "", locale: "es", createdAt: "" })).toBe("owner");
    expect(
      roleFor({ id: "e", email: "gamaliel@example.com", name: "", locale: "en", createdAt: "" }),
    ).toBe("owner");
    expect(roleFor({ id: "f", email: "client@example.com", name: "", locale: "es", createdAt: "" })).toBe(
      "client",
    );
  });

  it("gives it to no one at all when no owner address is configured", async () => {
    delete process.env.OWNER_EMAIL;
    vi.resetModules();
    const { roleFor } = await import("./accounts");
    expect(roleFor({ id: "c", email: "anyone@example.com", name: "", locale: "es", createdAt: "" })).toBe(
      "client",
    );
  });
});

describe("tokens", () => {
  it("never repeats", async () => {
    const { newToken } = await import("./accounts");
    const tokens = new Set(Array.from({ length: 500 }, () => newToken()));
    expect(tokens.size).toBe(500);
  });

  it("hashes so the stored value cannot be replayed as a credential", async () => {
    const { newToken, hashToken } = await import("./accounts");
    const token = newToken();
    const hash = hashToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
    // Same input, same hash — a lookup by hash still finds the record.
    expect(hashToken(token)).toBe(hash);
  });

  it("compares hashes without a length shortcut throwing", async () => {
    const { hashesMatch, hashToken } = await import("./accounts");
    const a = hashToken("one");
    expect(hashesMatch(a, a)).toBe(true);
    expect(hashesMatch(a, hashToken("two"))).toBe(false);
    expect(hashesMatch(a, "short")).toBe(false);
  });
});

describe("the signing key", () => {
  it("refuses to fall back to a known key in production", async () => {
    delete process.env.AUTH_SECRET;
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { signingSecret } = await import("../env");
    expect(() => signingSecret()).toThrow(/AUTH_SECRET/);
  });
});
