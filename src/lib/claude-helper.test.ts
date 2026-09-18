import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one place a Claude call is actually made. Everything about *what* to
 * ask is another module's job (`office-helper.ts` and its test); this file
 * only checks what `claudeHelperCall` does with what comes back — join the
 * text, refuse on a refusal, and never throw.
 */

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function FakeAnthropic() {
    return { beta: { messages: { create } } };
  }),
}));

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
