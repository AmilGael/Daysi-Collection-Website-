import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

/**
 * The one place a Claude call is actually made on Daysi's behalf, shared by
 * the office helper (`office-helper.ts`) and, later, a visitor-facing one.
 * Everything about *what* to ask — the rules, the manual, the state, the
 * question — is the caller's; this module only knows how to ask it and how
 * to come back with either an answer or nothing.
 *
 * Mirrors `translate.ts`: the SDK call is one injectable function, so every
 * caller is testable without a network, and every kind of trouble — no key,
 * a refusal, a timeout, an empty reply, anything thrown — comes back as
 * `null` rather than an exception, because a helper that cannot answer must
 * never take down the page that asked it.
 */

export type HelperTurn = { readonly role: "user" | "assistant"; readonly text: string };

/**
 * A conversation the Claude API accepts starts with a user turn. A sheet
 * that rolls a failed question back out of its thread (see `help-sheet.tsx`)
 * can still hand this an earlier assistant turn with nothing before it — the
 * question that opened it never landed — so any leading assistant turns are
 * dropped rather than sent.
 *
 * Shared by both helpers (`office-helper.ts` for Daysi, `site-helper.ts` for
 * a visitor), since a thread rolled back the same way needs the same fix
 * either side, and lives beside `HelperTurn` rather than in either helper so
 * neither has to import the other.
 */
export function dropLeadingAssistant(history: readonly HelperTurn[]): readonly HelperTurn[] {
  const start = history.findIndex((turn) => turn.role !== "assistant");
  return start === -1 ? [] : history.slice(start);
}

export type HelperCall = (input: {
  readonly system: Anthropic.Beta.Messages.BetaTextBlockParam[];
  readonly messages: Anthropic.Beta.Messages.BetaMessageParam[];
  readonly maxTokens: number;
}) => Promise<string | null>;

/**
 * What the failure is worth logging, and nothing more: an `Anthropic.APIError`
 * carries the HTTP status and a subclass name (`RateLimitError`,
 * `AuthenticationError`…) that `.name` itself never sets — every one of the
 * SDK's error classes inherits the plain "Error" from `Error.prototype`, so
 * the constructor's own name is the only useful one. Anything else thrown
 * (a timeout, an abort) keeps whatever name it already has.
 */
function failureDetails(error: unknown): { readonly name: string; readonly status?: number } {
  if (error instanceof Anthropic.APIError) {
    return { name: error.constructor.name, status: error.status };
  }
  return { name: error instanceof Error ? error.name : "unknown" };
}

/** The real SDK call. Never a date-suffixed model id; see global constraints. */
export function claudeHelperCall(apiKey: string): HelperCall {
  const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 0 });
  return async ({ system, messages, maxTokens }) => {
    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5",
        max_tokens: maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        // A refused answer is retried server-side on another Claude model.
        fallbacks: "default",
        output_config: { effort: "low" },
        system,
        messages,
      });
      if (response.stop_reason === "refusal") return null;

      const text = response.content
        .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      if (text.length > 0) return text;

      // Thinking counts against max_tokens too, so a low ceiling can end the
      // turn before a single word of the answer is written — worth telling
      // apart from every other reason a reply might come back empty.
      if (response.stop_reason === "max_tokens") {
        console.warn("[claude-helper] max_tokens with no text");
      }
      return null;
    } catch (error) {
      // Never the question itself: it may be about a client's order, and a
      // log is not the place for that.
      const { name, status } = failureDetails(error);
      console.warn("[claude-helper] the call failed:", status !== undefined ? `${status} ${name}` : name);
      return null;
    }
  };
}

/** `null` when there is no key to call with — the caller decides what that means. */
export function defaultHelperCall(): HelperCall | null {
  return env.anthropicApiKey ? claudeHelperCall(env.anthropicApiKey) : null;
}

/**
 * The house style has no em or en dashes, and a model left to itself writes
 * them. The rules ask it not to; this makes sure. A dash between two numbers
 * ("10–18") becomes a hyphen; anywhere else it becomes a comma.
 */
export function withoutDashes(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*([.,;:!?])/g, "$1")
    .replace(/^,\s*/gm, "");
}
