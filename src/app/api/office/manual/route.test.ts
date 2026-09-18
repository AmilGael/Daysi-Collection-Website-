import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Abrir el manual": owner-only, and the manual's own HTML, unmodified.
 */

const viewer = vi.hoisted(() => ({ role: "owner" as string | null }));
vi.mock("@/lib/auth/session", () => ({
  currentViewer: vi.fn(async () => (viewer.role ? { role: viewer.role } : null)),
}));

beforeEach(() => {
  vi.resetModules();
  viewer.role = "owner";
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function get(headers: Record<string, string> = {}) {
  const { GET } = await import("./route");
  return GET(
    new Request("http://localhost:3000/api/office/manual", {
      headers: { referer: "http://localhost:3000/es/office", host: "localhost:3000", ...headers },
    }),
    undefined,
  );
}

describe("the office manual route", () => {
  it("hands the owner the manual, as html", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const body = await response.text();
    expect(body).toContain("Manual del taller");
    expect(body).toContain("Cómo entrar");
  });

  it("tells anyone else the address does not exist", async () => {
    viewer.role = "client";

    expect((await get()).status).toBe(404);
  });

  it("refuses a request that did not come from this site", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost:3000/api/office/manual"), undefined);
    expect(response.status).toBe(403);
  });
});
