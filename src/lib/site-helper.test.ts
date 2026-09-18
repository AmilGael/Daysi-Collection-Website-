import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { HelperCall } from "./claude-helper";

/**
 * `helperData` builds what the model reads, in the visitor's own language;
 * `askSiteHelper` is what the route calls, with a fake `HelperCall` standing
 * in for the network exactly as `office-helper.test.ts` fakes one.
 */

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-site-helper-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("helperData", () => {
  it("carries every live garment, at the price it actually sells at, in the visitor's language", async () => {
    const { helperData } = await import("./site-helper");
    const { formatMoney } = await import("./money");

    const es = helperData("es");
    expect(es).toContain(`Camisa campera Yurumein, /es/collection/yurumein: ${formatMoney(12000, "es")} (Algodón wax)`);

    const en = helperData("en");
    expect(en).toContain(`Yurumein camp shirt, /en/collection/yurumein: ${formatMoney(12000, "en")} (Wax print cotton)`);
  });

  it("carries the general price list by category and fabric, the alterations, and the sessions", async () => {
    const { helperData } = await import("./site-helper");
    const { formatMoney } = await import("./money");

    const state = helperData("es");
    expect(state).toContain(
      `Camisas en Algodón wax: ${formatMoney(12000, "es")} (a medida +${formatMoney(4400, "es")})`,
    );
    expect(state).toContain(`Ruedo de vestido o falda: ${formatMoney(2800, "es")}`);
    expect(state).toContain(`Consulta de 30 minutos: ${formatMoney(8000, "es")}`);
  });

  it("carries the hours and a WhatsApp fact with no address — the panel's own button is that step", async () => {
    const { helperData } = await import("./site-helper");

    const state = helperData("es");
    expect(state).toContain("Lunes: 10:00–18:00");
    expect(state).toContain("Domingo: cerrado");
    expect(state).toContain("- WhatsApp");
    expect(state).not.toContain("wa.me");
    expect(state).toContain("no se negocian");
  });

  it("names a running promotion beside the price it lowers", async () => {
    const { savePromotion } = await import("./live-promotions");
    await savePromotion({
      id: "prm-visitor1",
      label: { en: "Autumn sale", es: "Venta de otoño" },
      kind: "percent",
      value: 15,
      scope: { type: "style", styleId: "yurumein" },
      active: true,
    });

    const { helperData } = await import("./site-helper");
    const { formatMoney } = await import("./money");
    const es = helperData("es");

    expect(es).toContain(`${formatMoney(10200, "es")} (Algodón wax), promoción Venta de otoño`);
    // The list price on its own, undiscounted, should not stand in for it.
    expect(es).not.toContain(`Camisa campera Yurumein, /es/collection/yurumein: ${formatMoney(12000, "es")}`);
  });
});

describe("askSiteHelper", () => {
  it("builds the system from the rules and the live data, tagged with the visitor's locale", async () => {
    const { askSiteHelper } = await import("./site-helper");
    const calls: { system: readonly { text: string }[]; messages: readonly { role: string; content: unknown }[] }[] = [];
    const fakeCall: HelperCall = async ({ system, messages }) => {
      calls.push({ system, messages });
      return "una respuesta";
    };

    const answer = await askSiteHelper(
      { question: "¿Cuánto cuesta un ruedo de pantalón?", locale: "es", history: [] },
      fakeCall,
    );

    expect(answer).toBe("una respuesta");
    expect(calls).toHaveLength(1);
    const { system, messages } = calls[0]!;
    expect(system.some((block) => block.text.includes("Ruedo de pantalón"))).toBe(true);
    expect(messages).toEqual([{ role: "user", content: "[es] ¿Cuánto cuesta un ruedo de pantalón?" }]);
  });

  it("tags the message with the locale the visitor's page is in, whatever language they typed", async () => {
    const { askSiteHelper } = await import("./site-helper");
    let seenMessages: readonly { role: string; content: unknown }[] = [];
    const fakeCall: HelperCall = async ({ messages }) => {
      seenMessages = messages;
      return "ok";
    };

    await askSiteHelper({ question: "¿cuánto cuesta?", locale: "en", history: [] }, fakeCall);

    expect(seenMessages).toEqual([{ role: "user", content: "[en] ¿cuánto cuesta?" }]);
  });

  it("marks only the data block for caching, and never the rules", async () => {
    const { askSiteHelper } = await import("./site-helper");
    let seenSystem: readonly Record<string, unknown>[] = [];
    const fakeCall: HelperCall = async ({ system }) => {
      seenSystem = system as unknown as Record<string, unknown>[];
      return "ok";
    };

    await askSiteHelper({ question: "hola", locale: "es", history: [] }, fakeCall);

    const cached = seenSystem.filter((block) => block.cache_control !== undefined);
    expect(cached).toHaveLength(1);
    expect(cached[0]!.cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
    expect(String(cached[0]!.text)).toContain("Camisas en Algodón wax");
  });

  it("tells the model to name the fabric with a price, write plain text, give bare paths, and say WhatsApp with no address", async () => {
    const { askSiteHelper } = await import("./site-helper");
    let rules = "";
    const fakeCall: HelperCall = async ({ system }) => {
      rules = String(system[0]!.text);
      return "ok";
    };

    await askSiteHelper({ question: "hola", locale: "es", history: [] }, fakeCall);

    expect(rules).toContain("name the");
    expect(rules).toContain("fabric");
    expect(rules).toContain("plain text only");
    expect(rules).toContain("never Markdown");
    expect(rules).toContain("bare path");
    expect(rules).toContain('just say "WhatsApp"');
    expect(rules).toContain("never a wa.me address");
  });

  it("drops a leading assistant turn, so a rolled-back thread still starts with the visitor", async () => {
    const { askSiteHelper } = await import("./site-helper");
    let seenMessages: readonly { role: string; content: unknown }[] = [];
    const fakeCall: HelperCall = async ({ messages }) => {
      seenMessages = messages;
      return "ok";
    };

    await askSiteHelper(
      {
        question: "¿y ahora?",
        locale: "es",
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
      { role: "user", content: "[es] ¿y ahora?" },
    ]);
  });

  it("returns null when the call refuses — a refusal answers the same as silence", async () => {
    const { askSiteHelper } = await import("./site-helper");
    const refuses: HelperCall = async () => null;

    expect(await askSiteHelper({ question: "hola", locale: "es", history: [] }, refuses)).toBeNull();
  });

  it("returns null, and asks nothing, when there is no call at all", async () => {
    const { askSiteHelper } = await import("./site-helper");

    expect(await askSiteHelper({ question: "hola", locale: "es", history: [] }, null)).toBeNull();
  });
});

describe("helperVisible", () => {
  it("is shown by default, before Daysi ever touches the switch", async () => {
    const { helperVisible } = await import("./site-helper");

    expect(helperVisible()).toBe(true);
  });

  it("remembers Daysi's switch, off then on again", async () => {
    const { helperVisible, saveHelperVisibility } = await import("./site-helper");

    await saveHelperVisibility(false);
    expect(helperVisible()).toBe(false);

    await saveHelperVisibility(true);
    expect(helperVisible()).toBe(true);
  });
});
