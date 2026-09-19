"use server";

import type { Localized } from "@/content";
import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { translationEnabled } from "@/lib/env";
import { manageableStyles } from "@/lib/live-catalog";
import { announcementVersions, manageableAnnouncements, saveAnnouncement } from "@/lib/announcements";
import { manageablePromotions, promotionVersions, savePromotion } from "@/lib/live-promotions";
import { LEAST_AMOUNT, MOST_PERCENT } from "@/lib/promotions";
import { changesOf, shopfrontChangeSchema, type ShopfrontChange } from "@/lib/office-validation";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";
import { saveHelperVisibility } from "@/lib/site-helper";
import { translateToEnglish, withEnglish } from "@/lib/translate";

/**
 * The two words of a promotion's name. When this promotion has carried the
 * same Spanish before (a switch turned off, an undo), that line's English
 * comes back with it rather than a fresh translation; otherwise the English
 * is written now, or copied from the Spanish when there is none to be had.
 *
 * A pairing whose English is only a copy of the Spanish — saved with no key
 * present — is not reused once a key arrives: that copy would otherwise
 * follow the label forever, since nothing else ever asks for it again.
 */
async function labelFor(id: string | undefined, spanish: string): Promise<Localized> {
  const known = id ? promotionVersions(id).findLast((version) => version.label.es === spanish) : undefined;
  if (known && !(translationEnabled && known.label.en === known.label.es)) return known.label;
  return withEnglish({ label: spanish }, await translateToEnglish({ label: spanish }, "promotion")).label!;
}

/**
 * An announcement's two languages, the same way as a promotion's name: the
 * English it carried before for the same Spanish comes back with it (a
 * switch or a page changed, an undo), and is written fresh otherwise.
 */
async function announcementMessage(id: string | undefined, spanish: string): Promise<Localized> {
  const known = id ? announcementVersions(id).findLast((version) => version.message.es === spanish) : undefined;
  if (known && !(translationEnabled && known.message.en === known.message.es)) return known.message;
  return withEnglish({ message: spanish }, await translateToEnglish({ message: spanish }, "announcement")).message!;
}

async function saveAnnouncementChange(change: Extract<ShopfrontChange, { type: "announcement" }>): Promise<void> {
  if (change.id && !manageableAnnouncements().some((announcement) => announcement.id === change.id)) {
    throw new ChangeRefused("unknown-announcement");
  }
  await saveAnnouncement({
    id: change.id ?? newReference("ANN").toLowerCase(),
    message: await announcementMessage(change.id, change.message),
    pages: change.pages,
    visible: change.visible,
  });
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
        case "announcement":
          await saveAnnouncementChange(change);
          return;
        case "promotion":
          await savePromotionChange(change);
          return;
        case "helper":
          await saveHelperVisibility(change.visible);
          return;
        case "retire":
        case "restore":
          if (change.kind === "announcement") {
            if (!manageableAnnouncements().some((announcement) => announcement.id === change.id)) {
              throw new ChangeRefused("unknown-announcement");
            }
            await setRetired("announcement", change.id, change.type === "retire");
            return;
          }
          if (!manageablePromotions().some((promotion) => promotion.id === change.id)) {
            throw new ChangeRefused("unknown-promotion");
          }
          await setRetired("promotion", change.id, change.type === "retire");
      }
    }),
  {
    revalidate: [
      "/[locale]/office/shopfront", "/[locale]", "/[locale]/appointments",
      // An announcement can sit on any page of the shop; the layout draws it.
      ["/[locale]", "layout"],
      // Every page that shows a garment's price, and the cart that charges it.
      "/[locale]/collection", "/[locale]/collection/[slug]", "/[locale]/premieres", "/[locale]/cart",
    ],
  },
);
