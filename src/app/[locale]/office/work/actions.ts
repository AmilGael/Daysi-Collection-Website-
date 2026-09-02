"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { changesOf, workChangeSchema } from "@/lib/office-validation";
import { findRequest, saveRequest } from "@/lib/request-store";
import { setRetired } from "@/lib/retired";

export const applyWorkChanges = ownerAction(
  changesOf(workChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      switch (change.type) {
        case "request-status": {
          const record = findRequest(change.reference);
          if (!record) throw new ChangeRefused("unknown-reference");
          if (record.status !== change.status) {
            await saveRequest({ ...record, status: change.status });
          }
          return;
        }
        case "retire":
          if (!findRequest(change.id)) throw new ChangeRefused("unknown-reference");
          await setRetired("request", change.id, true);
          return;
        case "restore":
          if (!findRequest(change.id)) throw new ChangeRefused("unknown-reference");
          await setRetired("request", change.id, false);
      }
    }),
  {
    revalidate: [
      "/[locale]/office/work",
      "/[locale]/office",
      "/[locale]/office/books",
      "/[locale]/account",
      "/[locale]/account/orders",
      "/[locale]/appointments",
    ],
  },
);
