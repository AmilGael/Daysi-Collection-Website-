import type { Cents, GarmentStyle, Promotion, StylePrice } from "@/content/types";
import type { Locale } from "@/i18n/routing";
import { applyRate, formatMoney } from "./money";

/**
 * Promotions, worked out: which one reaches a garment on a given day, and
 * what it takes off. Pure and safe in the browser, because the cards that
 * show a lowered price render inside client components. The live list is
 * read in `lib/live-promotions.ts`; the money is charged in `lib/pricing.ts`.
 *
 * Days compare as YYYY-MM-DD strings at the atelier (`shopDay`), the rule
 * the premieres follow: parsing "2026-09-27" would give midnight UTC, the
 * evening before in the Bronx, and a sale would end a night early.
 */

export type { Promotion, PromotionScope } from "@/content/types";

type Reachable = Pick<GarmentStyle, "id" | "categoryId">;

export function promotionApplies(promotion: Promotion, style: Reachable, day: string): boolean {
  if (!promotion.active) return false;
  if (promotion.startsAt !== undefined && day < promotion.startsAt) return false;
  if (promotion.endsAt !== undefined && day > promotion.endsAt) return false;
  switch (promotion.scope.type) {
    case "all":
      return true;
    case "category":
      return promotion.scope.categoryId === style.categoryId;
    case "style":
      return promotion.scope.styleId === style.id;
  }
}

/** How narrowly a promotion is aimed: one garment beats a category beats everything. */
const REACH: Record<Promotion["scope"]["type"], number> = { style: 3, category: 2, all: 1 };

/**
 * The one promotion a garment gets today. The most specific wins (its own,
 * then its category's, then everything's) whatever each takes off, and among
 * equals the one saved last. Never two: promotions do not stack.
 */
export function pickPromotion(
  promotions: readonly Promotion[],
  style: Reachable,
  day: string,
): Promotion | undefined {
  let best: Promotion | undefined;
  for (const promotion of promotions) {
    if (!promotionApplies(promotion, style, day)) continue;
    if (
      best === undefined ||
      REACH[promotion.scope.type] > REACH[best.scope.type] ||
      (REACH[promotion.scope.type] === REACH[best.scope.type] && promotion.updatedAt > best.updatedAt)
    ) {
      best = promotion;
    }
  }
  return best;
}

/** One piece's price once the promotion is taken off: to the cent, never below nothing. */
export function discountedAmount(amount: Cents, promotion: Promotion): Cents {
  const off = promotion.kind === "percent" ? applyRate(amount, promotion.value / 100) : promotion.value;
  return Math.min(amount, Math.max(0, amount - off));
}

/** The tag on a card: "−15 %" or "−$20". */
export function promotionBadge(promotion: Pick<Promotion, "kind" | "value">, locale: Locale): string {
  return promotion.kind === "percent"
    ? `−${promotion.value} %`
    : `−${formatMoney(promotion.value, locale)}`;
}

/**
 * What a card or the garment page shows for a resolved price: the lowered
 * amount, and beside it the list price and the promotion, only when a
 * promotion actually lowered it.
 */
export function promotedPrice(price: StylePrice): {
  readonly amount: Cents;
  readonly listAmount?: Cents;
  readonly promotion?: Promotion;
} {
  if (!price.promotion) return { amount: price.fixedPrice };
  const amount = discountedAmount(price.fixedPrice, price.promotion);
  if (amount === price.fixedPrice) return { amount };
  return { amount, listAmount: price.fixedPrice, promotion: price.promotion };
}
