import { readFileSync } from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { categories, translate } from "@/content";
import { OFFICE_TABS } from "@/components/office/tabs";
import es from "@/messages/es.json";
import { earningsFrom, loadLedger } from "./earnings";
import { formatMoney } from "./money";
import { liveFabrics, manageableAlterations, manageableAppointmentTypes, manageablePriceList } from "./live-pricing";
import { defaultHelperCall, type HelperCall, type HelperTurn } from "./claude-helper";

/**
 * The office's own "?" — answers about the office itself, from the manual
 * Daysi was handed and the price list as it stands right now, and nothing
 * else. It never writes anything; Confirmar cambios stays the only door.
 *
 * `helperSystem` is pure text-building and is exported for its own tests;
 * `askOfficeHelper` is what the route calls, with `claude-helper.ts`'s real
 * SDK call as its default and a fake one in tests, exactly as
 * `translateToEnglish` does.
 */

const MANUAL_PATH = path.join(process.cwd(), "docs", "manual-del-taller.html");

/** Read once per server lifetime; missing is a fact, not a retry. */
let manualHtml: string | null | undefined;

/** The manual's raw HTML, for the download route. `null` when it is missing. */
export function readManual(): string | null {
  if (manualHtml === undefined) {
    try {
      manualHtml = readFileSync(MANUAL_PATH, "utf8");
    } catch {
      manualHtml = null;
    }
  }
  return manualHtml;
}

/** The manual's words, without its markup or its styling — what the model reads. */
function manualAsText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

const RULES = [
  "Usted contesta, en español, las preguntas de Daysi sobre su propia oficina:",
  "qué botón tocar, qué pestaña usar, qué significa un estado, y cómo se",
  "compara un precio con la lista de abajo. Sea corta y directa, como una nota",
  "entre colegas.",
  "Nombre los botones y las pestañas exactamente como los llama la oficina",
  "(por ejemplo Confirmar cambios, Descartar, Estrenos).",
  'Si la respuesta no está en el manual ni en la lista de precios, diga: "Eso no está en el manual."',
  "No invente un botón, una pestaña ni un paso que no exista.",
  "No cite nunca un precio que no esté en la lista de abajo.",
  "La oficina nunca escribe nada por usted: usted solo contesta preguntas.",
].join(" ");

function fabricName(fabricId: string): string {
  const fabric = liveFabrics().find((candidate) => candidate.id === fabricId);
  return translate(fabric?.name ?? { en: fabricId, es: fabricId }, "es");
}

function categoryName(categoryId: string): string {
  const category = categories.find((candidate) => candidate.id === categoryId);
  return translate(category?.name ?? { en: categoryId, es: categoryId }, "es");
}

/** The live list, in Spanish, as Daysi's prices actually stand right now. */
function priceListText(): string {
  const lines: string[] = [];

  lines.push("Prendas:");
  for (const entry of manageablePriceList()) {
    if (entry.retired) continue;
    lines.push(
      `- ${categoryName(entry.categoryId)} en ${fabricName(entry.fabricId)}: ${formatMoney(entry.fixedPrice, "es")} (a medida +${formatMoney(entry.customizationExtra, "es")})`,
    );
  }

  lines.push("Arreglos:");
  for (const alteration of manageableAlterations()) {
    if (alteration.retired) continue;
    const rush = alteration.rushSurcharge > 0 ? ` (urgente +${formatMoney(alteration.rushSurcharge, "es")})` : "";
    lines.push(`- ${translate(alteration.name, "es")}: ${formatMoney(alteration.fixedPrice, "es")}${rush}`);
  }

  lines.push("Citas:");
  for (const session of manageableAppointmentTypes()) {
    if (session.retired) continue;
    lines.push(`- ${translate(session.name, "es")}: ${formatMoney(session.fee, "es")}`);
  }

  return lines.join("\n");
}

/**
 * Tabs, the live price list, and only a count of what is open — never a
 * client's name, email or phone. What Daysi is looking at, not who she is
 * looking at it for.
 */
function officeState(): string {
  const tabs = OFFICE_TABS.map((tab) => es.office[tab.labelKey as keyof typeof es.office]).join(", ");
  const openCount = earningsFrom(loadLedger()).openCount;
  return [`Pestañas de la oficina: ${tabs}.`, `Pedidos abiertos ahora: ${openCount}.`, priceListText()].join(
    "\n\n",
  );
}

/** The manual (stripped to text) and the live state, ready for the system prompt. */
export function helperSystem(): { manual: string; state: string } {
  const html = readManual();
  return {
    manual: html ? manualAsText(html) : "",
    state: officeState(),
  };
}

export async function askOfficeHelper(
  input: { readonly question: string; readonly tab: string; readonly history: readonly HelperTurn[] },
  call: HelperCall | null = defaultHelperCall(),
): Promise<string | null> {
  if (!call) return null;

  const { manual, state } = helperSystem();
  const system: Anthropic.Beta.Messages.BetaTextBlockParam[] = [{ type: "text", text: RULES }];
  if (manual) {
    system.push({ type: "text", text: manual, cache_control: { type: "ephemeral", ttl: "1h" } });
  }
  system.push({ type: "text", text: state });

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    ...input.history.map((turn) => ({ role: turn.role, content: turn.text })),
    { role: "user" as const, content: `[Pestaña: ${input.tab}] ${input.question}` },
  ];

  return call({ system, messages, maxTokens: 1024 });
}
