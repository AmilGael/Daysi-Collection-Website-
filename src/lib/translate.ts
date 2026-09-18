import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
// The SDK's structured-output helper is built against the zod/v4 engine
// specifically, not the classic API the rest of this file (and the rest of
// the codebase) uses — so the one schema it consumes is built with this.
import { z as zodV4 } from "zod/v4";
import { env } from "./env";

/**
 * Spanish in, English out, at confirm time.
 *
 * Daysi writes every word once, in Spanish. This turns the fields that
 * changed into English through the Claude API and hands them back by the
 * same keys; the action writes both languages. It answers null for every
 * kind of trouble (no key, nothing to say, a malformed reply, a timeout)
 * and never throws, because a translation problem must never stop a photo
 * from landing: the caller copies the Spanish instead, and the office shows
 * that copy as "Inglés pendiente" until she asks for it again.
 *
 * The SDK call is one injectable function so the rest is testable without
 * a network. A refusal is treated like any other failure; the copy is the
 * fallback, so no server-side fallback model is configured.
 */

export type TranslationContext = "garment" | "photo" | "alteration";

export type TranslationRequest = {
  readonly system: string;
  readonly prompt: string;
  readonly keys: readonly string[];
};
export type TranslationCall = (request: TranslationRequest) => Promise<unknown>;

const SYSTEM = [
  "You translate a Bronx tailoring atelier's Spanish copy into English for its website.",
  "Daysi Collection makes custom garments, alterations and Garífuna heritage pieces.",
  "Garment and fabric names are names and stay as they are (Frutera, Sirena, Amapola).",
  "Keep the register plain and warm, and keep roughly the same length.",
  "No quotation marks, no added claims, no explanations: return only the fields asked for.",
].join(" ");

function promptFor(fields: Readonly<Record<string, string>>, keys: readonly string[], context: TranslationContext): string {
  const picked = Object.fromEntries(keys.map((key) => [key, fields[key]]));
  const what = {
    garment: "a garment for sale",
    photo: "a caption under a finished piece in the gallery",
    alteration: "a service on the atelier's price list, an alteration or a booked session",
  }[context];
  return `Context: ${what}.\nTranslate each field from Spanish to English:\n${JSON.stringify(picked)}`;
}

function sdkCall(apiKey: string): TranslationCall {
  const client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 0 });
  return async ({ system, prompt, keys }) => {
    const shape = Object.fromEntries(keys.map((key) => [key, zodV4.string()]));
    const response = await client.messages.parse({
      model: "claude-opus-5",
      // Short copy: at most four fields of at most 400 characters each.
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(zodV4.object(shape)) },
    });
    return response.parsed_output;
  };
}

function defaultCall(): TranslationCall | null {
  return env.anthropicApiKey ? sdkCall(env.anthropicApiKey) : null;
}

export async function translateToEnglish(
  fields: Readonly<Record<string, string>>,
  context: TranslationContext,
  call: TranslationCall | null = defaultCall(),
): Promise<Record<string, string> | null> {
  const keys = Object.keys(fields).filter((key) => fields[key]!.trim().length > 0);
  if (!call || keys.length === 0) return null;
  try {
    const raw = await call({ system: SYSTEM, prompt: promptFor(fields, keys, context), keys });
    const reply = z.object(Object.fromEntries(keys.map((key) => [key, z.string().trim().min(1)])));
    const parsed = reply.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Each field as the pair the catalog stores; the Spanish stands in where there is no English. */
export function withEnglish(
  spanish: Readonly<Record<string, string>>,
  english: Readonly<Record<string, string>> | null,
): Record<string, { es: string; en: string }> {
  return Object.fromEntries(
    Object.entries(spanish).map(([key, es]) => [key, { es, en: english?.[key] ?? es }]),
  );
}
