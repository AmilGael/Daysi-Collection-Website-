import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoredRequest } from "@/lib/request-store";

/**
 * The photo a client sent with a request — a design's mockup, an alteration's
 * snapshot — shown to Daysi in the Hub. It is a client's picture, so it is
 * hers alone: anyone else is told the address does not exist, and nothing
 * along the way keeps a copy.
 */

const viewer = vi.hoisted(() => ({ role: "owner" as string | null }));
vi.mock("@/lib/auth/session", () => ({
  currentViewer: vi.fn(async () => (viewer.role ? { role: viewer.role } : null)),
}));

let dir: string;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

beforeEach(() => {
  vi.resetModules();
  viewer.role = "owner";
  dir = mkdtempSync(path.join(tmpdir(), "daysi-office-photos-"));
  process.env.DATA_DIR = dir;
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

async function storeDesign(reference = "DSN-ACDEFGH3") {
  const { saveRequest } = await import("@/lib/request-store");
  const record: StoredRequest = {
    reference,
    kind: "design",
    submittedAt: "2026-09-18T12:00:00.000Z",
    locale: "es",
    client: { name: "", email: "ana@example.com" },
    details: {},
    photoFile: `${reference}.png`,
    status: "paid",
  };
  await saveRequest(record);
  mkdirSync(path.join(dir, "photos"), { recursive: true });
  writeFileSync(path.join(dir, "photos", `${reference}.png`), PNG);
}

async function get(reference: string) {
  const { GET } = await import("./route");
  return GET(
    new Request(`http://localhost:3000/api/office/photos/${reference}`, {
      headers: { referer: "http://localhost:3000/es/office", host: "localhost:3000" },
    }),
    { params: Promise.resolve({ reference }) },
  );
}

describe("the office's view of a request photo", () => {
  it("hands Daysi the stored picture, typed, and not to be kept by any cache", async () => {
    await storeDesign();

    const response = await get("DSN-ACDEFGH3");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it("tells anyone else the address does not exist", async () => {
    await storeDesign();
    viewer.role = "client";

    expect((await get("DSN-ACDEFGH3")).status).toBe(404);
  });

  it("answers 404 for a reference with no photo, a path, or a file that has gone", async () => {
    await storeDesign();
    rmSync(path.join(dir, "photos", "DSN-ACDEFGH3.png"));

    expect((await get("DSN-ACDEFGH3")).status).toBe(404);
    expect((await get("DSN-NOBODY00")).status).toBe(404);
    expect((await get("..%2F..%2Faccounts.jsonl")).status).toBe(404);
  });
});
