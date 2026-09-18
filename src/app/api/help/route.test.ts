import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public help route: same-origin only, rate-limited per caller, and
 * otherwise a thin wrapper around `askSiteHelper` and `helperVisible` —
 * which have their own tests for what they actually do. Both are faked here
 * so this file only ever exercises the route's own decisions, exactly as
 * `api/office/help/route.test.ts` does for the office's own route.
 */

const helper = vi.hoisted(() => ({
  ask: vi.fn(async (): Promise<string | null> => "El ruedo de pantalón cuesta $28."),
  visible: vi.fn(() => true),
}));
vi.mock("@/lib/site-helper", () => ({
  askSiteHelper: helper.ask,
  helperVisible: helper.visible,
}));

beforeEach(() => {
  vi.resetModules();
  helper.ask.mockReset();
  helper.ask.mockResolvedValue("El ruedo de pantalón cuesta $28.");
  helper.visible.mockReset();
  helper.visible.mockReturnValue(true);
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/help", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      referer: "http://localhost:3000/es",
      host: "localhost:3000",
      "x-forwarded-for": "203.0.113.9",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function post(body: unknown, headers?: Record<string, string>) {
  const { POST } = await import("./route");
  return POST(request(body, headers));
}

describe("the public help route", () => {
  it("answers a visitor's question", async () => {
    const response = await post({ question: "¿Cuánto cuesta un ruedo de pantalón?", locale: "es", history: [] });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ answer: "El ruedo de pantalón cuesta $28." });
    expect(helper.ask).toHaveBeenCalledWith({
      question: "¿Cuánto cuesta un ruedo de pantalón?",
      locale: "es",
      history: [],
    });
  });

  it("refuses a request that did not come from this site", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost:3000/api/help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "hola", locale: "es", history: [] }),
      }),
    );

    expect(response.status).toBe(403);
    expect(helper.ask).not.toHaveBeenCalled();
  });

  it("rejects a question past 400 characters, an unsupported locale, or more than six turns of history", async () => {
    expect((await post({ question: "a".repeat(401), locale: "es", history: [] })).status).toBe(400);
    expect((await post({ question: "hola", locale: "fr", history: [] })).status).toBe(400);
    expect(
      (
        await post({
          question: "hola",
          locale: "es",
          history: Array.from({ length: 7 }, () => ({ role: "user", text: "hola" })),
        })
      ).status,
    ).toBe(400);
    expect(helper.ask).not.toHaveBeenCalled();
  });

  it("answers 503, without asking, when there is no key configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const response = await post({ question: "hola", locale: "es", history: [] });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "helper-off" });
    expect(helper.ask).not.toHaveBeenCalled();
  });

  it("answers 503, without asking, when Daysi has switched the helper off", async () => {
    helper.visible.mockReturnValue(false);

    const response = await post({ question: "hola", locale: "es", history: [] });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "helper-off" });
    expect(helper.ask).not.toHaveBeenCalled();
  });

  it("answers 502 when the helper has nothing to say", async () => {
    helper.ask.mockResolvedValue(null);

    const response = await post({ question: "hola", locale: "es", history: [] });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "no-answer" });
  });

  it("stops a caller at 10 questions in an hour", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await post({ question: `pregunta ${i}`, locale: "es", history: [] })).status).toBe(200);
    }

    const over = await post({ question: "una más", locale: "es", history: [] });
    expect(over.status).toBe(429);
    expect(over.headers.get("retry-after")).not.toBeNull();
  });

  it("does not share one caller's budget with another's", async () => {
    for (let i = 0; i < 10; i += 1) {
      await post({ question: `pregunta ${i}`, locale: "es", history: [] });
    }

    const response = await post(
      { question: "hola", locale: "es", history: [] },
      { "x-forwarded-for": "198.51.100.4" },
    );
    expect(response.status).toBe(200);
  });

  it("refuses the 201st question site-wide, even across many callers each under their own budget", async () => {
    for (let caller = 0; caller < 20; caller += 1) {
      for (let i = 0; i < 10; i += 1) {
        const response = await post(
          { question: `pregunta ${caller}-${i}`, locale: "es", history: [] },
          { "x-forwarded-for": `198.51.100.${caller}` },
        );
        expect(response.status).toBe(200);
      }
    }

    const over = await post(
      { question: "una más", locale: "es", history: [] },
      { "x-forwarded-for": "198.51.100.99" },
    );
    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ error: "rate-limited" });
  });
});
