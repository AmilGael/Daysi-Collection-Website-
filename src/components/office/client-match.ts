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

/** What a key does in the name box, worked out without the component. */
export type PickerKeyResult =
  | { readonly kind: "move"; readonly active: number }
  | { readonly kind: "pick"; readonly index: number }
  | { readonly kind: "close" }
  | { readonly kind: "ignore" };

/**
 * The name box's keys, as a combobox answers them: Down and Up move the
 * highlight through the `count` matches and wrap at either end (opening a
 * shut list on the first or last), Enter takes the highlighted match,
 * Escape shuts an open list. `active` is the highlighted index, -1 for
 * none. Anything else is "ignore": Enter with nothing highlighted stays
 * the form's, and Escape with the list shut stays the sheet's.
 */
export function pickerKey(key: string, active: number, count: number, open: boolean): PickerKeyResult {
  if (key === "ArrowDown" || key === "ArrowUp") {
    if (count === 0) return { kind: "ignore" };
    const down = key === "ArrowDown";
    if (!open || active < 0 || active >= count) return { kind: "move", active: down ? 0 : count - 1 };
    return { kind: "move", active: down ? (active + 1) % count : (active - 1 + count) % count };
  }
  if (key === "Enter") return open && active >= 0 && active < count ? { kind: "pick", index: active } : { kind: "ignore" };
  if (key === "Escape") return open ? { kind: "close" } : { kind: "ignore" };
  return { kind: "ignore" };
}
