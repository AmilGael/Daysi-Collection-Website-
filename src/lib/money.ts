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
