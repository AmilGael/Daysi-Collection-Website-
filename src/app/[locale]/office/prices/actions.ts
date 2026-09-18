"use server";

import { alterationServices, appointmentTypes } from "@/content";
import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { changesOf, priceChangeSchema, type PriceChange } from "@/lib/office-validation";
import { liveStylesUsingEntry } from "@/lib/in-use";
import {
  addedAlterations,
  addedAppointmentTypes,
  liveAlterations,
  liveAppointmentTypes,
  manageablePriceList,
  saveAddedAlteration,
  saveAddedAppointmentType,
  saveAlterationOverride,
  saveAppointmentOverride,
  saveEntryOverride,
} from "@/lib/live-pricing";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";
import { translateToEnglish, withEnglish } from "@/lib/translate";

/** Past the booked length, time is billed in half hours at the coded sessions' rate. */
const OVERTIME_PER_HALF_HOUR = 4000;

/**
 * A retire or a restore on Precios, by the list it names. A garment price
 * checks that no garment still uses it; an alteration or a session can only
 * be one Daysi added, since the ones the site shipped with are the list the
 * site promises and are repriced, never taken away.
 */
async function setServiceRetired(
  change: Extract<PriceChange, { type: "retire" | "restore" }>,
): Promise<void> {
  const retire = change.type === "retire";
  switch (change.kind ?? "price-entry") {
    case "price-entry": {
      if (!manageablePriceList().some((entry) => entry.id === change.id)) throw new ChangeRefused("unknown-entry");
      if (retire) {
        const count = liveStylesUsingEntry(change.id);
        if (count > 0) throw new ChangeRefused("in-use", count);
      }
      await setRetired("price-entry", change.id, retire);
      return;
    }
    case "alteration":
      if (alterationServices.some((alteration) => alteration.id === change.id)) throw new ChangeRefused("coded-service");
      if (!addedAlterations().some((alteration) => alteration.id === change.id)) throw new ChangeRefused("unknown-alteration");
      await setRetired("alteration", change.id, retire);
      return;
    case "appointment-type":
      if (appointmentTypes.some((type) => type.id === change.id)) throw new ChangeRefused("coded-service");
      if (!addedAppointmentTypes().some((type) => type.id === change.id)) throw new ChangeRefused("unknown-appointment");
      await setRetired("appointment-type", change.id, retire);
  }
}

export const applyPriceChanges = ownerAction(
  changesOf(priceChangeSchema),
  async (changes) => applyEach(changes, async (change) => {
    switch (change.type) {
      case "entry":
        if (!manageablePriceList().some((entry) => entry.id === change.id)) throw new ChangeRefused("unknown-entry");
        await saveEntryOverride({ entryId: change.id, fixedPrice: change.fixedPrice, customizationExtra: change.customizationExtra });
        return;
      case "alteration":
        if (!liveAlterations().some((alteration) => alteration.id === change.id)) throw new ChangeRefused("unknown-alteration");
        await saveAlterationOverride({ alterationId: change.id, fixedPrice: change.fixedPrice, rushSurcharge: change.rushSurcharge });
        return;
      case "appointment":
        if (!liveAppointmentTypes().some((type) => type.id === change.id)) throw new ChangeRefused("unknown-appointment");
        await saveAppointmentOverride({ typeId: change.id, fee: change.fee });
        return;
      case "alteration-add": {
        // Typed in Spanish only; the English is written here, or copied from
        // the Spanish when there is no translation to be had.
        const spanish = { name: change.name, description: change.description, turnaround: change.turnaround };
        const words = withEnglish(spanish, await translateToEnglish(spanish, "alteration"));
        await saveAddedAlteration({
          id: newReference("ALT").toLowerCase(),
          name: words.name!,
          description: words.description!,
          fixedPrice: change.fixedPrice,
          rushSurcharge: change.rushSurcharge,
          turnaround: words.turnaround!,
          ...(change.photo ? { photo: change.photo } : {}),
        });
        return;
      }
      case "appointment-add": {
        const spanish = { name: change.name, suitedFor: change.suitedFor };
        const words = withEnglish(spanish, await translateToEnglish(spanish, "alteration"));
        await saveAddedAppointmentType({
          id: newReference("SES").toLowerCase(),
          minutes: change.minutes,
          name: words.name!,
          // The one line she writes is what the session is for; the booking
          // page shows it under the name, where the coded ones keep a longer
          // description as well.
          description: { es: "", en: "" },
          fee: change.fee,
          // The whole fee holds the slot, as it does for every session.
          depositDue: change.fee,
          overtimeRatePerHalfHour: OVERTIME_PER_HALF_HOUR,
          suitedFor: change.suitedFor ? [words.suitedFor!] : [],
        });
        return;
      }
      case "retire":
      case "restore":
        await setServiceRetired(change);
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
