"use server";

import { applyEach, ownerAction } from "@/lib/action-guard";
import { saveNotice } from "@/lib/live-catalog";
import { changesOf, shopfrontChangeSchema } from "@/lib/office-validation";

export const applyShopfrontChanges = ownerAction(
  changesOf(shopfrontChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      await saveNotice({ message: change.message, visible: change.visible });
    }),
  { revalidate: ["/[locale]/office/shopfront", "/[locale]", "/[locale]/appointments"] },
);
