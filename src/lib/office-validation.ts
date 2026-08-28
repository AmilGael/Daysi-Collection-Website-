import { z } from "zod";
import { categories } from "@/content";

/**
 * The shapes the office endpoints accept, kept out of the route files so they
 * can be tested directly.
 *
 * These schemas decide what Daysi is allowed to say, which is why the style id
 * here is a plain string rather than a list of the ids in `content/styles.ts`:
 * a garment she added herself carries a generated id, and an enum of the coded
 * ones silently locked her out of managing her own work. Whether the id names
 * a real garment is a question for the catalog, not the parser.
 */

export const styleOverrideSchema = z.object({
  styleId: z.string().trim().min(1).max(60),
  isPublished: z.boolean(),
  stock: z
    .object({ s: z.boolean().optional(), m: z.boolean().optional(), l: z.boolean().optional() })
    .strict(),
  addedPhotos: z
    .array(z.string().regex(/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/))
    .max(12)
    .optional(),
  coverSrc: z.string().max(200).optional(),
});

export const styleCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(10).max(400),
  detail: z.string().trim().max(400).default(""),
  color: z.string().trim().max(80).default(""),
  categoryId: z.enum(categories.map((category) => category.id) as [string, ...string[]]),
  fabricId: z.string().trim().min(1).max(60),
  /** Only consulted when the garment-and-cloth pair has no published price. */
  fixedPrice: z.number().int().min(0).max(5_000_00).optional(),
  sizes: z.object({ s: z.boolean(), m: z.boolean(), l: z.boolean() }).strict(),
  photos: z
    .array(z.string().regex(/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/))
    .min(1)
    .max(8),
});
