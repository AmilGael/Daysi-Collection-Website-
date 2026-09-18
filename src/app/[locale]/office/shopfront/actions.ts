"use server";

import type { Localized } from "@/content";
import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { manageableStyles, saveNotice } from "@/lib/live-catalog";
import { manageablePromotions, promotionVersions, savePromotion } from "@/lib/live-promotions";
import { changesOf, shopfrontChangeSchema, type ShopfrontChange } from "@/lib/office-validation";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";
import { translateToEnglish, withEnglish } from "@/lib/translate";

/** A percent past this would be giving the garment away; below it the site takes any. */
const MOST_PERCENT = 90;
/** The least an amount may take off: a dollar, like the least a price may be. */
const LEAST_AMOUNT = 100;

/**
 * The two words of a promotion's name. When this promotion has carried the
 * same Spanish before (a switch turned off, an undo), that line's English
 * comes back with it rather than a fresh translation; otherwise the English
 * is written now, or copied from the Spanish when there is none to be had.
 */
async function labelFor(id: string | undefined, spanish: string): Promise<Localized> {
  const known = id ? promotionVersions(id).findLast((version) => version.label.es === spanish) : undefined;
  if (known) return known.label;
  return withEnglish({ label: spanish }, await translateToEnglish({ label: spanish }, "promotion")).label!;
}

async function savePromotionChange(change: Extract<ShopfrontChange, { type: "promotion" }>): Promise<void> {
  if (change.kind === "percent" ? change.value > MOST_PERCENT : change.value < LEAST_AMOUNT) {
    throw new ChangeRefused("bad-value");
  }
  if (change.startsAt && change.endsAt && change.endsAt < change.startsAt) throw new ChangeRefused("bad-dates");
  const scope = change.scope;
  if (scope.type === "style" && !manageableStyles().some((style) => style.id === scope.styleId)) {
    throw new ChangeRefused("unknown-style");
  }
  if (change.id && !manageablePromotions().some((promotion) => promotion.id === change.id)) {
    throw new ChangeRefused("unknown-promotion");
  }

  await savePromotion({
    id: change.id ?? newReference("PRM").toLowerCase(),
    label: await labelFor(change.id, change.label),
    kind: change.kind,
    value: change.value,
    scope,
    ...(change.startsAt ? { startsAt: change.startsAt } : {}),
    ...(change.endsAt ? { endsAt: change.endsAt } : {}),
    active: change.active,
  });
}

export const applyShopfrontChanges = ownerAction(
  changesOf(shopfrontChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      switch (change.type) {
        case "notice":
          await saveNotice({ message: change.message, visible: change.visible });
          return;
        case "promotion":
          await savePromotionChange(change);
          return;
        // On this tab a retire or a restore always names a promotion.
        case "retire":
        case "restore":
          if (!manageablePromotions().some((promotion) => promotion.id === change.id)) {
            throw new ChangeRefused("unknown-promotion");
          }
          await setRetired("promotion", change.id, change.type === "retire");
      }
    }),
  {
    revalidate: [
      "/[locale]/office/shopfront", "/[locale]", "/[locale]/appointments",
      // Every page that shows a garment's price, and the cart that charges it.
      "/[locale]/collection", "/[locale]/collection/[slug]", "/[locale]/premieres", "/[locale]/cart",
    ],
  },
);
