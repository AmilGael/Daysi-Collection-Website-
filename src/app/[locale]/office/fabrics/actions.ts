"use server";

import { fabrics } from "@/content";
import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { customFabrics, saveCustomFabric } from "@/lib/live-pricing";
import { changesOf, fabricChangeSchema } from "@/lib/office-validation";
import { slugify } from "@/lib/slugify";

export const applyFabricChanges = ownerAction(
  changesOf(fabricChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      if (change.type !== "fabric-add") throw new ChangeRefused("invalid");
      const { type: _type, key: _key, ...draft } = change;
      const taken = new Set([
        ...fabrics.map((fabric) => fabric.id),
        ...customFabrics().map((fabric) => fabric.id),
      ]);
      let id = slugify(draft.name, 40);
      if (id.length < 2) throw new ChangeRefused("invalid");
      while (taken.has(id)) id = `${id}-2`;

      await saveCustomFabric({ id, ...draft });
    }),
  {
    revalidate: [
      "/[locale]/office/fabrics",
      "/[locale]/design-studio",
      "/[locale]/prices",
      "/[locale]/office/collection",
      "/[locale]/office/prices",
    ],
  },
);
