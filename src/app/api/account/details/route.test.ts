import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The client's own route: origin checked before the session, the session
 * checked before the rate limit, and the account this route ever writes to
 * is always the one `currentViewer` proved, never one named in the body.
 */

const viewer = vi.hoisted(() => ({
  value: null as { account: { id: string; email: string; name: string; locale: "es" | "en"; createdAt: string }; role: "client" | "owner" } | null,
}));
vi.mock("@/lib/auth/session", () => ({
  currentViewer: vi.fn(async () => viewer.value),
}));

const account = { id: "acc_1", email: "ana@example.com", name: "Ana", locale: "es" as const, createdAt: "2026-09-01T00:00:00Z" };

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "client-details-"));
  process.env.DATA_DIR = dir;
  viewer.value = { account, role: "client" };
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function request(method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/account/details", {
    method,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      host: "localhost:3000",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function post(body: unknown, headers?: Record<string, string>) {
  const { POST } = await import("./route");
  return POST(request("POST", body, headers));
}

async function del(headers?: Record<string, string>) {
  const { DELETE } = await import("./route");
  return DELETE(request("DELETE", undefined, headers));
}

describe("the client's own details route", () => {
  it("refuses another origin before anything else", async () => {
    const response = await post(
      { name: "Ana", measurements: { waist: { value: 30, unit: "in" } } },
      { origin: "https://evil.example" },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "bad-origin" });

    const { currentViewer } = await import("@/lib/auth/session");
    expect(currentViewer).not.toHaveBeenCalled();
    const { cardForAccount } = await import("@/lib/client-cards");
    expect(cardForAccount(account)).toBeUndefined();
  });

  it("answers 401 when nobody is signed in", async () => {
    viewer.value = null;

    const response = await post({ name: "Ana", measurements: {} });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "signed-out" });
  });

  it("saves the signed-in client's own card and says how many measurements it has", async () => {
    const response = await post({ name: "Ana", measurements: { waist: { value: 30, unit: "in" } } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, measured: 1 });

    const { cardForAccount } = await import("@/lib/client-cards");
    const card = cardForAccount(account);
    expect(card?.measurements.waist?.by).toBe("client");
  });

  it("ignores an email in the body: the card is always the account's", async () => {
    const response = await post({
      name: "Ana",
      email: "other@example.com",
      measurements: {},
    });

    expect(response.status).toBe(200);

    const { cardForAccount } = await import("@/lib/client-cards");
    const card = cardForAccount(account);
    expect(card?.email).toBe("ana@example.com");
  });

  it("names the fields a bad body got wrong", async () => {
    const response = await post({ name: "Ana", measurements: { waist: { value: 320, unit: "in" } } });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid", fields: ["measurements.waist"] });
  });

  it("rate-limits saves per caller", async () => {
    for (let i = 0; i < 20; i += 1) {
      const response = await post({ name: "Ana", measurements: { waist: { value: 30, unit: "in" } } });
      expect(response.status).toBe(200);
    }

    const over = await post({ name: "Ana", measurements: { waist: { value: 30, unit: "in" } } });

    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ error: "rate-limited" });
    expect(over.headers.get("retry-after")).not.toBeNull();
  });

  it("clears on DELETE", async () => {
    await post({
      name: "Ana",
      address: { line1: "1 Grand Concourse", city: "Bronx", state: "NY", zip: "10451" },
      measurements: {},
    });

    const response = await del();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cleared: true });

    const { CLIENT_CARDS } = await import("@/lib/client-cards");
    const file = readFileSync(path.join(dir, `${CLIENT_CARDS}.jsonl`), "utf8");
    expect(file).not.toContain("Grand Concourse");
  });

  it("refuses a DELETE from another origin before anything else", async () => {
    const response = await del({ origin: "https://evil.example" });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "bad-origin" });
    const { currentViewer } = await import("@/lib/auth/session");
    expect(currentViewer).not.toHaveBeenCalled();
  });

  it("answers a DELETE with 401 when nobody is signed in", async () => {
    viewer.value = null;

    const response = await del();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "signed-out" });
  });

  it("says nothing was cleared when there is no card to clear", async () => {
    const response = await del();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "nothing-to-clear" });
  });

  /**
   * A torn line makes the whole collection read as empty, so the card is
   * not found: the route must not say it cleared an address that is still
   * on disk.
   */
  it("does not claim a clear when the file cannot be read, and leaves it alone", async () => {
    const { CLIENT_CARDS } = await import("@/lib/client-cards");
    const file = path.join(dir, `${CLIENT_CARDS}.jsonl`);
    const torn = `${JSON.stringify({ id: "cli_a", accountId: "acc_1", name: "Ana", email: "ana@example.com", address: { line1: "1 Grand Concourse", city: "Bronx", state: "NY", zip: "10451" }, measurements: {}, updatedAt: "2026-09-12T00:00:00Z", updatedBy: "client" })}\n{"id":"cli_b","na\n`;
    writeFileSync(file, torn);

    const response = await del();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "nothing-to-clear" });
    expect(readFileSync(file, "utf8")).toBe(torn);
  });
});
