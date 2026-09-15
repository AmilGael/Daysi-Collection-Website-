import type { Cents } from "@/content/types";
import type { Locale } from "@/i18n/routing";

export const CURRENCY = "USD";

/**
 * Money is held in whole cents everywhere. Nothing in this codebase multiplies
 * or divides a dollar float, which is how rounding errors get into invoices.
 */
export function formatMoney(amount: Cents, locale: Locale): string {
  return new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

/** Rounds to the nearest cent, away from zero, so a half cent never disappears. */
export function applyRate(amount: Cents, rate: number): Cents {
  return Math.round(amount * rate);
}

export function sum(amounts: readonly Cents[]): Cents {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/**
 * Cents from what someone typed into a price box.
 *
 * Accepts a comma as the decimal mark: a phone showing a Spanish keyboard
 * offers a comma on its number pad where an English one offers a point, and
 * `parseFloat("195,50")` would quietly read as 195. Anything that is not a
 * plain non-negative amount with at most two decimals is null; the caller
 * decides the range.
 */
export function centsFromInput(text: string): number | null {
  const normalised = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(normalised)) return null;
  return Math.round(parseFloat(normalised) * 100);
}
