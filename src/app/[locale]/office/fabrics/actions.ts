"use server";

import { fabrics } from "@/content";
import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { liveStylesUsingFabric } from "@/lib/in-use";
import { manageableCustomFabrics, saveCustomFabric } from "@/lib/live-pricing";
import { changesOf, fabricChangeSchema } from "@/lib/office-validation";
import { setRetired } from "@/lib/retired";
import { slugify } from "@/lib/slugify";

export const applyFabricChanges = ownerAction(
  changesOf(fabricChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      switch (change.type) {
        case "fabric-add": {
          const { type: _type, key: _key, ...draft } = change;
          const taken = new Set([
            ...fabrics.map((fabric) => fabric.id),
            ...manageableCustomFabrics().map((fabric) => fabric.id),
          ]);
          let id = slugify(draft.name, 40);
          if (id.length < 2) throw new ChangeRefused("invalid");
          while (taken.has(id)) id = `${id}-2`;
          await saveCustomFabric({ id, ...draft });
          return;
        }
        case "retire": {
          if (!manageableCustomFabrics().some((fabric) => fabric.id === change.id)) {
            throw new ChangeRefused("unknown-fabric");
          }
          const count = liveStylesUsingFabric(change.id);
          if (count > 0) throw new ChangeRefused("in-use", count);
          await setRetired("fabric", change.id, true);
          return;
        }
        case "restore":
          if (!manageableCustomFabrics().some((fabric) => fabric.id === change.id)) {
            throw new ChangeRefused("unknown-fabric");
          }
          await setRetired("fabric", change.id, false);
      }
    }),
  {
    revalidate: [
      "/[locale]/office/fabrics",
      "/[locale]/design-studio",
      "/[locale]/prices",
      "/[locale]/office/collection",
      "/[locale]/office/prices",
      "/[locale]/collection/[slug]",
      "/[locale]/request",
    ],
  },
);
