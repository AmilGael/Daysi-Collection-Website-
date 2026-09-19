import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The office help route: owner-only, rate-limited per owner, and otherwise
 * a thin wrapper around `askOfficeHelper` — which has its own tests for what
 * it actually asks. `currentViewer` and `askOfficeHelper` are both faked here
 * so this file only ever exercises the route's own decisions.
 */

const viewer = vi.hoisted(() => ({
  value: { role: "owner" as string | null, account: { email: "daysi@example.com" } },
}));
vi.mock("@/lib/auth/session", () => ({
  currentViewer: vi.fn(async () =>
    viewer.value.role ? { role: viewer.value.role, account: viewer.value.account } : null,
  ),
}));

const helper = vi.hoisted(() => ({
  ask: vi.fn(async (): Promise<string | null> => "Toque Confirmar cambios."),
}));
vi.mock("@/lib/office-helper", () => ({ askOfficeHelper: helper.ask }));

beforeEach(() => {
  vi.resetModules();
  viewer.value = { role: "owner", account: { email: "daysi@example.com" } };
  helper.ask.mockReset();
  helper.ask.mockResolvedValue("Toque Confirmar cambios.");
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/office/help", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      referer: "http://localhost:3000/es/office",
      host: "localhost:3000",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function post(body: unknown, headers?: Record<string, string>) {
  const { POST } = await import("./route");
  return POST(request(body, headers), undefined);
}

describe("the office help route", () => {
  it("answers the owner's question", async () => {
    const response = await post({ question: "¿Qué botón guarda?", tab: "hub", history: [] });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ answer: "Toque Confirmar cambios." });
    expect(helper.ask).toHaveBeenCalledWith({
      question: "¿Qué botón guarda?",
      tab: "hub",
      history: [],
    });
  });

  it("tells anyone else the address does not exist", async () => {
    viewer.value = { role: "client", account: { email: "cliente@example.com" } };

    const response = await post({ question: "hola", tab: "hub", history: [] });

    expect(response.status).toBe(404);
    expect(helper.ask).not.toHaveBeenCalled();
  });

  it("refuses a request that did not come from this site", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost:3000/api/office/help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "hola", tab: "hub", history: [] }),
      }),
      undefined,
    );

    expect(response.status).toBe(403);
  });

  it("rejects a question past 500 characters, a tab past 30, or more than six turns of history", async () => {
    expect((await post({ question: "a".repeat(501), tab: "hub", history: [] })).status).toBe(400);
    expect((await post({ question: "hola", tab: "a".repeat(31), history: [] })).status).toBe(400);
    expect(
      (
        await post({
          question: "hola",
          tab: "hub",
          history: Array.from({ length: 7 }, () => ({ role: "user", text: "hola" })),
        })
      ).status,
    ).toBe(400);
    expect(helper.ask).not.toHaveBeenCalled();
  });

  it("answers 503, without asking, when there is no key configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const response = await post({ question: "hola", tab: "hub", history: [] });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "helper-off" });
    expect(helper.ask).not.toHaveBeenCalled();
  });

  it("answers 502 when the helper has nothing to say", async () => {
    helper.ask.mockResolvedValue(null);

    const response = await post({ question: "hola", tab: "hub", history: [] });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "no-answer" });
  });

  it("stops the owner at 30 questions in an hour", async () => {
    for (let i = 0; i < 30; i += 1) {
      expect((await post({ question: `pregunta ${i}`, tab: "hub", history: [] })).status).toBe(200);
    }

    const over = await post({ question: "una más", tab: "hub", history: [] });
    expect(over.status).toBe(429);
    expect(over.headers.get("retry-after")).not.toBeNull();
  });

  it("does not share one owner's budget with another's", async () => {
    for (let i = 0; i < 30; i += 1) {
      await post({ question: `pregunta ${i}`, tab: "hub", history: [] });
    }
    viewer.value = { role: "owner", account: { email: "otra@example.com" } };

    const response = await post({ question: "hola", tab: "hub", history: [] });
    expect(response.status).toBe(200);
  });
});
