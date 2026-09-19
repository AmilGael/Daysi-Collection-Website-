"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { businessInstant } from "@/lib/availability";
import { changesOf, workChangeSchema } from "@/lib/office-validation";
import { estimateCharged, estimateNoted, type NotedOrderKind } from "@/lib/pricing";
import { findRequest, saveRequest, type StoredRequest } from "@/lib/request-store";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";
import { chargeRecord } from "@/lib/office-charge";

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
            // A line she noted herself never went through Stripe, so nothing
            // else stamps paidAt for it; the Hub's trend by month reads that
            // stamp, not the day she happened to move the status.
            const stampPaid = record.source === "office" && change.status === "paid" && !record.paidAt;
            await saveRequest({
              ...rest,
              status: change.status,
              source: "office",
              ...(stampPaid ? { paidAt: new Date().toISOString() } : {}),
            });
          }
          return;
        }
        case "order-note": {
          if (change.paid && change.charge) throw new ChangeRefused("bad-value");
          const now = new Date().toISOString();
          // Noon, so the calendar day it lands on never rolls with the offset
          // between EST and EDT; absent, it is today, exactly as before this.
          const moment = change.date ? businessInstant(change.date, "12:00").toISOString() : now;
          const record: StoredRequest = {
            reference: newReference(NOTED_PREFIX[change.kind]),
            kind: change.kind,
            submittedAt: moment,
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
            // A charged note is asked of the client, not received: its receipt
            // must not say "total recibido" before a cent has come in.
            estimate: change.charge ? estimateCharged(change.amount) : estimateNoted(change.amount, change.kind),
            source: "office",
            status: change.paid ? "paid" : "new",
            paidVia: "office",
            ...(change.paid ? { paidAt: moment } : {}),
          };
          await saveRequest(record);
          // The note is hers either way; the link is a second step Stripe may
          // refuse. Refused, the row stays open and its sheet offers the
          // link again, rather than the whole note being lost to it.
          if (change.charge) {
            const charged = await chargeRecord(record.reference, change.amount);
            if (!charged.ok) console.warn(`[office] No payment link for ${record.reference}: ${charged.error}.`);
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
      "/[locale]/office",
      "/[locale]/office/books",
      "/[locale]/account",
      "/[locale]/account/orders",
      "/[locale]/appointments",
    ],
  },
);
