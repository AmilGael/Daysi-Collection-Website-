"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { changesOf, workChangeSchema } from "@/lib/office-validation";
import { currentRecords, listRequests, saveRequest } from "@/lib/request-store";

export const applyWorkChanges = ownerAction(
  changesOf(workChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      if (change.type !== "request-status") throw new ChangeRefused("invalid");
      const record = currentRecords(listRequests(change.kind)).find(
        (candidate) => candidate.reference === change.reference,
      );
      if (!record) throw new ChangeRefused("unknown-reference");
      if (record.status !== change.status) {
        await saveRequest({ ...record, status: change.status });
      }
    }),
  {
    revalidate: [
      "/[locale]/office/work",
      "/[locale]/office",
      "/[locale]/office/books",
      "/[locale]/account",
      "/[locale]/account/orders",
    ],
  },
);
