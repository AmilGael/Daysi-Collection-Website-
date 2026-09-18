import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HelperTurn } from "./claude-helper";

/**
 * The one place a Claude call is actually made. Everything about *what* to
 * ask is another module's job (`office-helper.ts` and its test); this file
 * only checks what `claudeHelperCall` does with what comes back — join the
 * text, refuse on a refusal, log a failure usefully and never throw.
 *
 * The fake default export carries the real `APIError` (and its subclasses)
 * so `error instanceof Anthropic.APIError` still works against it, exactly
 * as the real SDK's default export does.
 */

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  const FakeAnthropic = vi.fn().mockImplementation(function FakeAnthropic() {
    return { beta: { messages: { create } } };
  });
  return { ...actual, default: Object.assign(FakeAnthropic, { APIError: actual.APIError }) };
});

beforeEach(() => {
  vi.resetModules();
  create.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("claudeHelperCall", () => {
  it("joins every text block into one answer", async () => {
    const { claudeHelperCall } = await import("./claude-helper");
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [
        { type: "text", text: "Primera parte. " },
        { type: "text", text: "Segunda parte." },
      ],
    });

    const call = claudeHelperCall("sk-test");
    const answer = await call({ system: [], messages: [{ role: "user", content: "hola" }], maxTokens: 100 });

    expect(answer).toBe("Primera parte. Segunda parte.");
  });

  it("sends the model, betas, fallbacks and effort the brief pins down", async () => {
    const { claudeHelperCall } = await import("./claude-helper");
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] });

    const call = claudeHelperCall("sk-test");
    await call({
      system: [{ type: "text", text: "reglas" }],
      messages: [{ role: "user", content: "hola" }],
      maxTokens: 777,
    });

    expect(create).toHaveBeenCalledWith({
      model: "claude-opus-5",
      max_tokens: 777,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: "reglas" }],
      messages: [{ role: "user", content: "hola" }],
    });
  });

  it("returns null when the model refuses", async () => {
    const { claudeHelperCall } = await import("./claude-helper");
    create.mockResolvedValue({ stop_reason: "refusal", content: [{ type: "text", text: "no debería verse" }] });

    const call = claudeHelperCall("sk-test");
    expect(await call({ system: [], messages: [], maxTokens: 100 })).toBeNull();
  });

  it("returns null when there is no text to answer with", async () => {
    const { claudeHelperCall } = await import("./claude-helper");
    create.mockResolvedValue({ stop_reason: "end_turn", content: [] });

    const call = claudeHelperCall("sk-test");
    expect(await call({ system: [], messages: [], maxTokens: 100 })).toBeNull();
  });

  it("returns null, and warns without the question, when the call throws", async () => {
    const { claudeHelperCall } = await import("./claude-helper");
    create.mockRejectedValue(new Error("a question about a client's wax-print order"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const call = claudeHelperCall("sk-test");
    const answer = await call({ system: [], messages: [], maxTokens: 100 });

    expect(answer).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]!.join(" ")).not.toContain("wax-print");
    warn.mockRestore();
  });

  it("logs the status and the subclass name of an Anthropic API error, never the message", async () => {
    const { claudeHelperCall } = await import("./claude-helper");
    const { RateLimitError } = await import("@anthropic-ai/sdk");
    create.mockRejectedValue(
      new RateLimitError(429, { message: "a question about a client's order" }, "a question about a client's order", new Headers()),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const call = claudeHelperCall("sk-test");
    const answer = await call({ system: [], messages: [], maxTokens: 100 });

    expect(answer).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls[0]!.join(" ");
    expect(logged).toContain("429");
    expect(logged).toContain("RateLimitError");
    expect(logged).not.toContain("a question about a client's order");
    warn.mockRestore();
  });

  it("logs a non-API error's own name — not just 'Error' — never the message", async () => {
    const { claudeHelperCall } = await import("./claude-helper");
    create.mockRejectedValue(new TypeError("a question about a client's wax-print order"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const call = claudeHelperCall("sk-test");
    const answer = await call({ system: [], messages: [], maxTokens: 100 });

    expect(answer).toBeNull();
    const logged = warn.mock.calls[0]!.join(" ");
    expect(logged).toContain("TypeError");
    expect(logged).not.toContain("wax-print");
    warn.mockRestore();
  });

  it("shows a max_tokens reply as is, when there is at least some text", async () => {
    const { claudeHelperCall } = await import("./claude-helper");
    create.mockResolvedValue({ stop_reason: "max_tokens", content: [{ type: "text", text: "Una respuesta que se corta" }] });

    const call = claudeHelperCall("sk-test");
    const answer = await call({ system: [], messages: [], maxTokens: 100 });

    expect(answer).toBe("Una respuesta que se corta");
  });

  it("returns null and logs when max_tokens cuts the reply before any text", async () => {
    const { claudeHelperCall } = await import("./claude-helper");
    create.mockResolvedValue({ stop_reason: "max_tokens", content: [] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const call = claudeHelperCall("sk-test");
    const answer = await call({ system: [], messages: [], maxTokens: 100 });

    expect(answer).toBeNull();
    expect(warn).toHaveBeenCalledWith("[claude-helper] max_tokens with no text");
    warn.mockRestore();
  });

  it("does not warn about max_tokens when a plain empty reply has some other stop reason", async () => {
    const { claudeHelperCall } = await import("./claude-helper");
    create.mockResolvedValue({ stop_reason: "end_turn", content: [] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const call = claudeHelperCall("sk-test");
    expect(await call({ system: [], messages: [], maxTokens: 100 })).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("dropLeadingAssistant", () => {
  it("drops every assistant turn at the start, keeping the first user turn onward", async () => {
    const { dropLeadingAssistant } = await import("./claude-helper");
    const history: HelperTurn[] = [
      { role: "assistant", text: "huérfana" },
      { role: "user", text: "la pregunta" },
      { role: "assistant", text: "la respuesta" },
    ];

    expect(dropLeadingAssistant(history)).toEqual([
      { role: "user", text: "la pregunta" },
      { role: "assistant", text: "la respuesta" },
    ]);
  });

  it("is empty when the history is only assistant turns, and unchanged when it already starts with the user", async () => {
    const { dropLeadingAssistant } = await import("./claude-helper");

    expect(dropLeadingAssistant([{ role: "assistant", text: "huérfana" }])).toEqual([]);
    expect(dropLeadingAssistant([])).toEqual([]);

    const startsWithUser: HelperTurn[] = [{ role: "user", text: "hola" }];
    expect(dropLeadingAssistant(startsWithUser)).toEqual(startsWithUser);
  });
});

describe("defaultHelperCall", () => {
  it("is null with no key, and a callable function with one", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { defaultHelperCall: withoutKey } = await import("./claude-helper");
    expect(withoutKey()).toBeNull();

    vi.resetModules();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const { defaultHelperCall: withKey } = await import("./claude-helper");
    expect(typeof withKey()).toBe("function");
  });
});
