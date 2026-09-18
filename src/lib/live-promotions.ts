import type { Promotion } from "@/content/types";
import { appendRecord, latestBy, readRecords, versionsOf } from "./records";
import { retiredSet } from "./retired";

/**
 * The promotions Daysi runs from the shop window, as append-only records:
 * each save is a new line, the newest line per id is the promotion, and a
 * retired one leaves every price without being deleted. Nothing is coded;
 * the site ships with none.
 */

const PROMOTIONS = "promotions";

/** Every promotion the office can show, retired ones marked. */
export function manageablePromotions(): (Promotion & { retired: boolean })[] {
  const retired = retiredSet("promotion");
  return latestBy(readRecords<Promotion>(PROMOTIONS), (record) => record.id).map((promotion) => ({
    ...promotion,
    retired: retired.has(promotion.id),
  }));
}

/** The ones that may lower a price: switched on and not retired. Their dates are for `pickPromotion`. */
export function livePromotions(): Promotion[] {
  return manageablePromotions()
    .filter((promotion) => promotion.active && !promotion.retired)
    .map(({ retired: _retired, ...promotion }) => promotion);
}

/** Every saved line of one promotion, oldest first. */
export function promotionVersions(id: string): Promotion[] {
  return versionsOf<Promotion>(PROMOTIONS, (record) => record.id, id);
}

export async function savePromotion(promotion: Omit<Promotion, "updatedAt">): Promise<void> {
  await appendRecord(PROMOTIONS, { ...promotion, updatedAt: new Date().toISOString() });
}
