"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { manageableClosures, saveClosure } from "@/lib/closures";
import { saveNotice } from "@/lib/live-catalog";
import { saveHoursOverride } from "@/lib/live-hours";
import { bookingsInClosure, bookingsOutsideHours } from "@/lib/in-use";
import { changesOf, shopfrontChangeSchema } from "@/lib/office-validation";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";

/** Today in the atelier's own zone, which is the only "today" that counts. */
function businessToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const applyShopfrontChanges = ownerAction(
  changesOf(shopfrontChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      switch (change.type) {
        case "notice":
          await saveNotice({ message: change.message, visible: change.visible });
          return;
        case "hours": {
          const stranded = bookingsOutsideHours(
            change.day,
            change.opens,
            change.closes,
            businessToday(),
          );
          if (stranded > 0) throw new ChangeRefused("day-booked", stranded);
          await saveHoursOverride({
            day: change.day,
            opens: change.opens,
            closes: change.closes,
          });
          return;
        }
        case "closure-add": {
          const closure = {
            id: newReference("CLO").toLowerCase(),
            from: change.from,
            to: change.to,
            note: change.note,
          };
          const stranded = bookingsInClosure({ ...closure, updatedAt: "" });
          if (stranded > 0) throw new ChangeRefused("day-booked", stranded);
          await saveClosure(closure);
          return;
        }
        case "retire":
          if (!manageableClosures().some((closure) => closure.id === change.id)) {
            throw new ChangeRefused("unknown-closure");
          }
          await setRetired("closure", change.id, true);
          return;
        case "restore": {
          const closure = manageableClosures().find((candidate) => candidate.id === change.id);
          if (!closure) throw new ChangeRefused("unknown-closure");
          const stranded = bookingsInClosure(closure);
          if (stranded > 0) throw new ChangeRefused("day-booked", stranded);
          await setRetired("closure", change.id, false);
        }
      }
    }),
  {
    revalidate: [
      "/[locale]/office/shopfront",
      "/[locale]",
      "/[locale]/appointments",
      "/[locale]/contact",
    ],
  },
);
