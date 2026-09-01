import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * What the volume can and cannot do. An intruder with a shell as the server's
 * user can append any line to /data; none of those lines may become a session,
 * a sign-in link, or a promotion to the office.
 */

const OWNER = "daysi@example.com";
const CLIENT = "client@example.com";

let dir: string;
const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  jar.clear();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-sessions-"));
  process.env.DATA_DIR = dir;
  process.env.OWNER_EMAIL = OWNER;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function load() {
  const accounts = await import("./accounts");
  const session = await import("./session");
  const links = await import("./sign-in-link");
  return { ...accounts, ...session, ...links };
}

function plant(collection: string, record: unknown) {
  appendFileSync(path.join(dir, `${collection}.jsonl`), `${JSON.stringify(record)}\n`);
}

const far = "2099-01-01T00:00:00.000Z";

describe("sessions this server issued", () => {
  it("come back as the account that signed in, with its role", async () => {
    const m = await load();
    const client = await m.findOrCreateAccount({ email: CLIENT, locale: "es" });
    await m.startSession(client);
    expect(await m.currentViewer()).toMatchObject({ account: { id: client.id }, role: "client" });

    jar.clear();
    const owner = await m.findOrCreateAccount({ email: OWNER, locale: "es" });
    await m.startSession(owner);
    expect(await m.currentViewer()).toMatchObject({ account: { id: owner.id }, role: "owner" });
  });

  it("end when signed out, and do not come back if the old line is replayed", async () => {
    const m = await load();
    const owner = await m.findOrCreateAccount({ email: OWNER, locale: "es" });
    await m.startSession(owner);
    const token = jar.get("daysi_session");
    const original = readFileSync(path.join(dir, "sessions.jsonl"), "utf8").split("\n")[0];

    await m.endSession();
    expect(await m.currentViewer()).toBeNull();

    // The intruder re-appends the genuine, validly signed line.
    appendFileSync(path.join(dir, "sessions.jsonl"), `${original}\n`);
    jar.set("daysi_session", token as string);
    expect(await m.currentViewer()).toBeNull();
  });
});

describe("lines an intruder appends to the volume", () => {
  it("cannot become a session, signed or not", async () => {
    const m = await load();
    const owner = await m.findOrCreateAccount({ email: OWNER, locale: "es" });
    const forged = {
      tokenHash: m.hashToken("chosen-by-intruder"),
      accountId: owner.id,
      email: OWNER,
      createdAt: new Date().toISOString(),
      expiresAt: far,
      revoked: false,
    };
    plant("sessions", forged);
    plant("sessions", { ...forged, sig: "not-a-real-signature" });
    jar.set("daysi_session", "chosen-by-intruder");
    expect(await m.currentViewer()).toBeNull();
  });

  it("cannot promote a client's real session to the office", async () => {
    const m = await load();
    const client = await m.findOrCreateAccount({ email: CLIENT, locale: "es" });
    await m.startSession(client);

    // Re-point the client's id at the owner's address, and the owner's address
    // at the client's id, in both orders an attacker might try.
    plant("accounts", { id: client.id, email: OWNER, name: "", locale: "es", createdAt: far });
    plant("accounts", { id: client.id, email: CLIENT, name: "", locale: "es", createdAt: far });
    const viewer = await m.currentViewer();
    expect(viewer?.role ?? "none").not.toBe("owner");
  });

  it("cannot become a sign-in link, while a real link still works", async () => {
    const m = await load();
    plant("sign-in-links", {
      tokenHash: m.hashToken("planted-link"),
      email: OWNER,
      locale: "es",
      expiresAt: far,
      usedAt: null,
    });
    expect(await m.consumeSignInLink("planted-link")).toBeNull();

    await m.sendSignInLink(CLIENT, "es");
    const printed = vi.mocked(console.info).mock.calls.flat().join("\n");
    const token = decodeURIComponent(/token=([^\s&]+)/.exec(printed)?.[1] ?? "");
    expect(token).not.toBe("");
    expect(await m.consumeSignInLink(token)).toMatchObject({ email: CLIENT });
    // Single use.
    expect(await m.consumeSignInLink(token)).toBeNull();
  });

  it("all die when the secret is rotated", async () => {
    const first = await load();
    const owner = await first.findOrCreateAccount({ email: OWNER, locale: "es" });
    await first.startSession(owner);
    expect(await first.currentViewer()).not.toBeNull();

    process.env.AUTH_SECRET = "rotated-after-an-incident";
    vi.resetModules();
    const second = await load();
    expect(await second.currentViewer()).toBeNull();
  });
});
