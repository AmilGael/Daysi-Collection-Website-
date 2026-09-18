"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { changesOf, workChangeSchema } from "@/lib/office-validation";
import { estimateNoted, type NotedOrderKind } from "@/lib/pricing";
import { findRequest, saveRequest, type StoredRequest } from "@/lib/request-store";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";

/** Which reference prefix names an order noted by kind, as the request form
 *  and the cart checkout already use for the same three kinds. */
const NOTED_PREFIX: Record<NotedOrderKind, string> = {
  order: "ORD",
  alteration: "ALT",
  commission: "CUS",
};

export const applyWorkChanges = ownerAction(
  changesOf(workChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      switch (change.type) {
        case "request-status": {
          const record = findRequest(change.reference);
          if (!record) throw new ChangeRefused("unknown-reference");
          if (record.status !== change.status) {
            // Moving the row on is how she answers a refused payment, so the
            // mark does not ride forward and hide every status after it.
            const { paymentFailed: _handled, ...rest } = record;
            await saveRequest({ ...rest, status: change.status, source: "office" });
          }
          return;
        }
        case "order-note": {
          const now = new Date().toISOString();
          const record: StoredRequest = {
            reference: newReference(NOTED_PREFIX[change.kind]),
            kind: change.kind,
            submittedAt: now,
            locale: "es",
            client: {
              name: change.clientName,
              email: change.email ?? "",
              ...(change.phone ? { phone: change.phone } : {}),
            },
            details: {
              Description: change.description,
              ...(change.notes ? { Notes: change.notes } : {}),
            },
            estimate: estimateNoted(change.amount, change.kind),
            source: "office",
            status: change.paid ? "paid" : "new",
            paidVia: "office",
            ...(change.paid ? { paidAt: now } : {}),
          };
          await saveRequest(record);
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
      "/[locale]/office",
      "/[locale]/office/books",
      "/[locale]/account",
      "/[locale]/account/orders",
      "/[locale]/appointments",
    ],
  },
);
