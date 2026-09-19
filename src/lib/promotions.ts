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

/**
 * The most a promotion ever takes off a piece, as a percent. A set amount
 * stops there too, so no promotion gives a garment away: a $0 line would
 * skip the payment and reach Daysi as an order nobody paid for, and a few
 * cents would fall under Stripe's smallest charge. The office refuses a
 * percent past it; an amount past it is taken as this much.
 */
export const MOST_PERCENT = 90;
/** The least a set amount may take off: a dollar, like the least a price may be. */
export const LEAST_AMOUNT = 100;
/** The most a set amount may be, as anywhere else she types a price. */
export const MOST_AMOUNT = 500_000;

/**
 * Whether a promotion is currently running at all — switched on and within
 * its NY-day dates — with no regard for what it reaches. Split out of
 * `promotionApplies` so a caller that already knows a promotion reaches
 * everything it cares about (the Promociones card's own count) can still
 * ask the same date question without a `style` to hand it.
 */
export function promotionActiveToday(
  promotion: Pick<Promotion, "active" | "startsAt" | "endsAt">,
  day: string,
): boolean {
  if (!promotion.active) return false;
  if (promotion.startsAt !== undefined && day < promotion.startsAt) return false;
  if (promotion.endsAt !== undefined && day > promotion.endsAt) return false;
  return true;
}

export function promotionApplies(promotion: Promotion, style: Reachable, day: string): boolean {
  if (!promotionActiveToday(promotion, day)) return false;
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

/**
 * One piece's price once the promotion is taken off, to the cent. A set
 * amount never takes more than `MOST_PERCENT` of the piece, so a positive
 * price never goes below a tenth of itself.
 */
export function discountedAmount(amount: Cents, promotion: Promotion): Cents {
  const off =
    promotion.kind === "percent"
      ? applyRate(amount, Math.min(promotion.value, MOST_PERCENT) / 100)
      : Math.min(promotion.value, applyRate(amount, MOST_PERCENT / 100));
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
