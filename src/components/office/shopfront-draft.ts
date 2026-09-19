import type { Promotion, PromotionScope } from "@/content";
import type { Locale } from "@/i18n/routing";
import type { ShopfrontChange } from "@/lib/office-validation";

/**
 * Shared types, keys and pure helpers for Vitrina's cards and its sheets —
 * kept out of shopfront-cards.tsx and promotion-editor.tsx so neither has to
 * import the other's grid or list to reach a type or a date format, the
 * cycle a reviewer caught on the gallery pass.
 */

export type ManagedPromotion = Promotion & { readonly undoable: boolean };
/** A name to show for a category or a garment; `retired` garments stay nameable but are not offered. */
export type ScopeOption = { readonly id: string; readonly name: string; readonly retired?: boolean };

/** The notice's one draft key, staged whether the text or the switch changed. */
export const NOTICE_KEY = "notice:site";

type PromotionWire = Extract<ShopfrontChange, { type: "promotion" }>;

export function promotionKeyFor(id: string): string {
  return `promotion:${id}`;
}

/** A promotion as the change that saves it again, with the switch where she put it. */
export function promotionWireOf(promotion: Promotion, active: boolean): PromotionWire {
  return {
    type: "promotion",
    key: promotionKeyFor(promotion.id),
    id: promotion.id,
    label: promotion.label.es,
    kind: promotion.kind,
    value: promotion.value,
    scope: promotion.scope,
    ...(promotion.startsAt ? { startsAt: promotion.startsAt } : {}),
    ...(promotion.endsAt ? { endsAt: promotion.endsAt } : {}),
    active,
  };
}

/** "all", "category:<id>" or "style:<id>": one select for the three reaches. */
export function scopeFromChoice(choice: string): PromotionScope {
  const [type, ...rest] = choice.split(":");
  const id = rest.join(":");
  if (type === "category") return { type: "category", categoryId: id };
  if (type === "style") return { type: "style", styleId: id };
  return { type: "all" };
}

export function formatDay(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

/**
 * The earliest `endsAt` among promotions the caller already knows are
 * active, on or after `today`; null when none of them carries an end date
 * that has not already passed. Read for the Promociones card's summary line
 * — a promotion's own `active` field is not consulted here, so a switch
 * staged but not yet confirmed is judged the same way the card's count
 * already judged it, rather than falling back to the stored value.
 */
export function soonestEnding<P extends Pick<Promotion, "endsAt">>(
  activePromotions: readonly P[],
  today: string,
): (P & { readonly endsAt: string }) | null {
  let best: (P & { readonly endsAt: string }) | null = null;
  for (const promotion of activePromotions) {
    const endsAt = promotion.endsAt;
    if (endsAt === undefined || endsAt < today) continue;
    if (best === null || endsAt < best.endsAt) best = { ...promotion, endsAt };
  }
  return best;
}
