"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { CardRefused, officeArchiveCard, officeRevertCard, officeSaveCard } from "@/lib/client-cards";
import { changesOf, clientChangeSchema } from "@/lib/office-validation";

export const applyClientChanges = ownerAction(
  changesOf(clientChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      try {
        switch (change.type) {
          case "client-save":
            await officeSaveCard(change);
            return;
          case "client-archive":
            await officeArchiveCard(change.id, change.archived);
            return;
          case "client-revert":
            await officeRevertCard(change.id, change.to);
        }
      } catch (error) {
        if (error instanceof CardRefused) throw new ChangeRefused(error.code);
        throw error;
      }
    }),
  { revalidate: ["/[locale]/office/clients", "/[locale]/office", "/[locale]/account", "/[locale]/account/details"] },
);
