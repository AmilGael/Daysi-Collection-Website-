"use server";

import { ownerAction } from "@/lib/action-guard";
import { previousChangeFor } from "@/lib/office-history";
import { undoQuerySchema } from "@/lib/office-validation";

export const readPreviousChange = ownerAction(
  undoQuerySchema,
  async ({ kind, id }) => ({ change: previousChangeFor(kind, id) ?? null }),
  { revalidate: [] },
);
