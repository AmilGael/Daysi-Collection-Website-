// Type only: client-book.ts reads the store and must never reach the browser.
import type { PickerEntry } from "@/lib/client-book";

export type { PickerEntry };

/**
 * The client-name box's pure matcher, kept out of the component so it can be
 * tested without a browser and without pulling next-intl into node.
 *
 * Nothing shows before two typed characters. From there a client is found by
 * her name's start or any word of it (accents folded, so "perez" finds
 * "Pérez"), by a phone's digits appearing anywhere in it (so the last seven
 * digits still find a number written with an area code), or by any part of
 * an email. At most `limit` come back, in the book's own order.
 */
export function matchClients(entries: readonly PickerEntry[], query: string, limit = 5): PickerEntry[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const folded = foldAccents(trimmed);
  const digits = digitsOf(trimmed);
  const lowered = trimmed.toLowerCase();

  const matches: PickerEntry[] = [];
  for (const entry of entries) {
    const name = foldAccents(entry.name);
    const nameMatch = name.startsWith(folded) || name.split(/\s+/).some((word) => word.startsWith(folded));
    const phoneMatch = digits.length > 0 && digitsOf(entry.phone).includes(digits);
    const emailMatch = entry.email.toLowerCase().includes(lowered);
    if (!nameMatch && !phoneMatch && !emailMatch) continue;
    matches.push(entry);
    if (matches.length >= limit) break;
  }
  return matches;
}

function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function digitsOf(text: string): string {
  return text.replace(/\D/g, "");
}
