import { business } from "@/content";

/**
 * A pre-filled WhatsApp message the client can send with one tap. WhatsApp is
 * how Daysi's clients already reach her, so the site offers it beside every
 * form rather than instead of one.
 *
 * `phone`, when given, opens a chat with that number instead of Daysi's own —
 * the Hub uses it to let her message a client straight from their request.
 * Every other caller leaves it out and reaches Daysi, as before.
 *
 * This lives apart from the notification code on purpose: it is used by client
 * components, and the notification module reaches into the filesystem-backed
 * store — which must never be pulled into a browser bundle.
 */
export function whatsappLink(message: string, phone?: string): string {
  const number = waNumber(phone ?? business.whatsapp);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * A typed phone, as `wa.me` wants it: a country code and nothing else. A
 * "+" means she (or the client) already wrote the country code, so every
 * digit is kept as is. With no "+", a bare 10-digit number is a US number
 * missing its "1", which stripping to digits alone would misread as
 * starting with a "7" area code; an 11-digit number already starting with
 * "1" is a US number that has it. Anything else is kept as typed — there is
 * no more to assume.
 */
function waNumber(typed: string): string {
  const digits = typed.replace(/[^0-9]/g, "");
  if (typed.includes("+")) return digits;
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits;
}
