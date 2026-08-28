import { z } from "zod";
import { ownerRoute } from "@/lib/api-guard";
import { saveNotice } from "@/lib/live-catalog";

/**
 * The atelier notice — one short line Daysi can hang on the site herself:
 * "Away until the 30th, orders resume after." Turning it off is a new record
 * with visible false, so the last wording survives for re-use.
 */

const noticeSchema = z.object({
  message: z.string().trim().max(200),
  visible: z.boolean(),
});

export const PUT = ownerRoute(noticeSchema, async (notice) => {
  await saveNotice(notice);
});
