import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { HelperCall } from "./claude-helper";
import type { StoredRequest } from "./request-store";

/**
 * `helperSystem` builds what the model reads; `askOfficeHelper` is what the
 * route calls, with a fake `HelperCall` standing in for the network exactly
 * as `translate.test.ts` fakes one for `translateToEnglish`.
 */

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-office-helper-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("helperSystem", () => {
  it("reads the manual, with its markup stripped, and the live price list", async () => {
    const { helperSystem } = await import("./office-helper");
    const { formatMoney } = await import("./money");

    const { manual, state } = helperSystem();

    // The manual's own words survive; its markup does not.
    expect(manual).toContain("Cómo entrar");
    expect(manual).not.toContain("<h2>");
    expect(manual).not.toContain("<style");

    // The coded price list, alterations and sessions, as they stand today.
    expect(state).toContain(`Camisas en Algodón wax: ${formatMoney(12000, "es")}`);
    expect(state).toContain(`Ruedo de vestido o falda: ${formatMoney(2800, "es")}`);
    expect(state).toContain(`Consulta de 30 minutos: ${formatMoney(8000, "es")}`);
  });

  it("holds a count of open orders, never a client's name, email or phone", async () => {
    const order: StoredRequest = {
      reference: "ORD-SECRET1",
      kind: "order",
      submittedAt: "2026-09-18T12:00:00.000Z",
      locale: "es",
      client: { name: "Cliente Secreto", email: "secreto@example.com", phone: "555-0100" },
      details: {},
      estimate: {
        lines: [],
        subtotal: 12000,
        salesTax: 0,
        total: 12000,
        dueNow: 0,
        dueOnCollection: 12000,
        dueNowReason: { en: "", es: "" },
      },
      status: "new",
    };
    const { saveRequest } = await import("./request-store");
    await saveRequest(order);

    const { helperSystem } = await import("./office-helper");
    const { state } = helperSystem();

    expect(state).toContain("Pedidos abiertos ahora: 1.");
    expect(state).not.toContain("Cliente Secreto");
    expect(state).not.toContain("secreto@example.com");
    expect(state).not.toContain("555-0100");
  });

  it("names every office tab, in Spanish, as the office itself does", async () => {
    const { helperSystem } = await import("./office-helper");
    const { state } = helperSystem();

    expect(state).toContain("Estrenos");
    expect(state).toContain("Precios");
  });
});

describe("askOfficeHelper", () => {
  it("builds the system from the manual and the live list, and passes the tab", async () => {
    const { askOfficeHelper } = await import("./office-helper");
    const calls: { system: readonly { text: string }[]; messages: readonly { role: string; content: unknown }[] }[] = [];
    const fakeCall: HelperCall = async ({ system, messages }) => {
      calls.push({ system, messages });
      return "una respuesta";
    };

    const answer = await askOfficeHelper(
      { question: "¿Qué es esto?", tab: "prices", history: [{ role: "user", text: "hola" }] },
      fakeCall,
    );

    expect(answer).toBe("una respuesta");
    expect(calls).toHaveLength(1);
    const { system, messages } = calls[0]!;
    expect(system.some((block) => block.text.includes("Cómo entrar"))).toBe(true);
    expect(system.some((block) => block.text.includes("Pedidos abiertos ahora"))).toBe(true);
    expect(messages).toEqual([
      { role: "user", content: "hola" },
      { role: "user", content: "[Pestaña: prices] ¿Qué es esto?" },
    ]);
  });

  it("drops a leading assistant turn, so a rolled-back history still starts with the owner", async () => {
    const { askOfficeHelper } = await import("./office-helper");
    let seenMessages: readonly { role: string; content: unknown }[] = [];
    const fakeCall: HelperCall = async ({ messages }) => {
      seenMessages = messages;
      return "ok";
    };

    await askOfficeHelper(
      {
        question: "¿y ahora?",
        tab: "hub",
        history: [
          { role: "assistant", text: "una respuesta huérfana" },
          { role: "user", text: "la siguiente pregunta" },
        ],
      },
      fakeCall,
    );

    expect(seenMessages[0]!.role).toBe("user");
    expect(seenMessages).toEqual([
      { role: "user", content: "la siguiente pregunta" },
      { role: "user", content: "[Pestaña: hub] ¿y ahora?" },
    ]);
  });

  it("marks the manual for an hour of caching, and only the manual", async () => {
    const { askOfficeHelper } = await import("./office-helper");
    let seenSystem: readonly Record<string, unknown>[] = [];
    const fakeCall: HelperCall = async ({ system }) => {
      seenSystem = system as unknown as Record<string, unknown>[];
      return "ok";
    };

    await askOfficeHelper({ question: "hola", tab: "hub", history: [] }, fakeCall);

    const cached = seenSystem.filter((block) => block.cache_control !== undefined);
    expect(cached).toHaveLength(1);
    expect(cached[0]!.cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
    expect(String(cached[0]!.text)).toContain("Cómo entrar");
  });

  it("raises the ceiling to 2048, so thinking never eats the whole answer", async () => {
    const { askOfficeHelper } = await import("./office-helper");
    let seenMaxTokens = 0;
    const fakeCall: HelperCall = async ({ maxTokens }) => {
      seenMaxTokens = maxTokens;
      return "ok";
    };

    await askOfficeHelper({ question: "hola", tab: "hub", history: [] }, fakeCall);

    expect(seenMaxTokens).toBe(2048);
  });

  it("returns null when the call does — a refusal answers the same as silence", async () => {
    const { askOfficeHelper } = await import("./office-helper");
    const refuses: HelperCall = async () => null;

    expect(await askOfficeHelper({ question: "hola", tab: "hub", history: [] }, refuses)).toBeNull();
  });

  it("returns null, and asks nothing, when there is no call at all", async () => {
    const { askOfficeHelper } = await import("./office-helper");

    expect(await askOfficeHelper({ question: "hola", tab: "hub", history: [] }, null)).toBeNull();
  });
});
