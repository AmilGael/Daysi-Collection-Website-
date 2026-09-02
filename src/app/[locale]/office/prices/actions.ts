"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { changesOf, priceChangeSchema } from "@/lib/office-validation";
import {
  liveAlterations,
  liveAppointmentTypes,
  livePriceList,
  saveAlterationOverride,
  saveAppointmentOverride,
  saveEntryOverride,
} from "@/lib/live-pricing";

export const applyPriceChanges = ownerAction(
  changesOf(priceChangeSchema),
  async (changes) => applyEach(changes, async (change) => {
    switch (change.type) {
      case "entry":
        if (!livePriceList().some((entry) => entry.id === change.id)) throw new ChangeRefused("unknown-entry");
        await saveEntryOverride({ entryId: change.id, fixedPrice: change.fixedPrice, customizationExtra: change.customizationExtra });
        return;
      case "alteration":
        if (!liveAlterations().some((alteration) => alteration.id === change.id)) throw new ChangeRefused("unknown-alteration");
        await saveAlterationOverride({ alterationId: change.id, fixedPrice: change.fixedPrice, rushSurcharge: change.rushSurcharge });
        return;
      case "appointment":
        if (!liveAppointmentTypes().some((type) => type.id === change.id)) throw new ChangeRefused("unknown-appointment");
        await saveAppointmentOverride({ typeId: change.id, fee: change.fee });
    }
  }),
  {
    revalidate: [
      "/[locale]/office/prices", "/[locale]/prices", "/[locale]/alterations",
      "/[locale]/appointments", "/[locale]/design-studio", "/[locale]/request",
      "/[locale]/collection/[slug]", "/[locale]/cart", "/[locale]/office/collection",
    ],
  },
);
