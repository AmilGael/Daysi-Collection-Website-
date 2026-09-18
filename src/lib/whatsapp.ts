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
  const number = (phone ?? business.whatsapp).replace(/[^0-9]/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
