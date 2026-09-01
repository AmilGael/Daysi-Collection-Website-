import { z } from "zod";
import { ownerRoute } from "@/lib/api-guard";
import { newReference } from "@/lib/security";
import { addGalleryWork, setGalleryVisibility } from "@/lib/live-gallery";

/**
 * Daysi's own additions to the portfolio. She uploads the photograph first
 * (see /api/office/uploads), then posts what it is.
 *
 * The intrinsic size comes from the browser because the layout needs it to
 * hold the space before the file arrives. It is bounded rather than trusted —
 * it decides how tall a box is, never what anything costs.
 */

const addSchema = z.object({
  src: z.string().regex(/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/),
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  category: z.enum(["runway", "commissions", "bridal", "accessories", "press", "workroom"]),
  caption: z.string().trim().max(200),
});

const visibilitySchema = z.object({
  id: z.string().trim().min(1).max(60),
  hidden: z.boolean(),
});

export const POST = ownerRoute(addSchema, async ({ caption, ...rest }) => {
  await addGalleryWork({
    id: newReference("GAL").toLowerCase(),
    ...rest,
    // One caption in her own words, shown in both languages. Asking her to
    // write every line twice is how a gallery stops getting updated.
    caption: { en: caption, es: caption },
  });
});

export const PATCH = ownerRoute(visibilitySchema, async ({ id, hidden }) => {
  await setGalleryVisibility(id, hidden);
});
