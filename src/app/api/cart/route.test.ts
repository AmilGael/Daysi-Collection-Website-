import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** A cart never holds more ready-made pieces of a counted size than are left. */

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  })),
  headers: vi.fn(async () => new Headers()),
}));

let dir: string;

beforeEach(async () => {
  vi.resetModules();
  jar.clear();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-cart-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

async function sol() {
  const { styles } = await import("@/content");
  const style = styles.find((candidate) => candidate.isPublished)!;
  const { saveStyleOverride } = await import("@/lib/live-catalog");
  await saveStyleOverride({
    styleId: style.id,
    isPublished: true,
    stock: { s: 1, m: 0 },
    countedAt: { s: "2026-09-01T12:00:00.000Z", m: "2026-09-01T12:00:00.000Z" },
  });
  return style;
}

async function post(body: Record<string, unknown>) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost:3000/api/cart", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify(body),
    }),
  );
}

describe("adding to the cart", () => {
  it("takes the last piece of a size", async () => {
    const style = await sol();
    expect((await post({ action: "add", styleSlug: style.slug, sizeId: "s", customize: false })).status).toBe(200);
  });

  it("refuses a second one once the last is in the cart", async () => {
    const style = await sol();
    await post({ action: "add", styleSlug: style.slug, sizeId: "s", customize: false });

    const response = await post({ action: "add", styleSlug: style.slug, sizeId: "s", customize: false });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "sold-out" });
  });

  it("refuses a sold-out size ready-made, and takes it made to measure", async () => {
    const style = await sol();
    expect((await post({ action: "add", styleSlug: style.slug, sizeId: "m", customize: false })).status).toBe(409);
    expect((await post({ action: "add", styleSlug: style.slug, sizeId: "m", customize: true })).status).toBe(200);
  });

  it("refuses raising the quantity past what is left, but always lets it come down", async () => {
    const style = await sol();
    await post({ action: "add", styleSlug: style.slug, sizeId: "s", customize: false });

    expect((await post({ action: "setQuantity", index: 0, quantity: 2 })).status).toBe(409);
    expect((await post({ action: "setQuantity", index: 0, quantity: 0 })).status).toBe(200);
  });
});
