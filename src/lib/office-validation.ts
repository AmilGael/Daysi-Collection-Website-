import { z } from "zod";
import { categories } from "@/content";
import type { ZodTypeAny } from "zod";

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

const uploadPath = z.string().regex(/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/);
export const changeKey = z.string().regex(/^[a-z-]+:[A-Za-z0-9._-]+$/).max(120);
const cents = z.number().int().min(0).max(5_000_00);
const fabricCents = z.number().int().min(1_00).max(5_000_00);
const id = z.string().trim().min(1).max(60);

export const styleOverrideSchema = z.object({
  styleId: z.string().trim().min(1).max(60),
  isPublished: z.boolean(),
  stock: z
    .object({ s: z.boolean().optional(), m: z.boolean().optional(), l: z.boolean().optional() })
    .strict(),
  addedPhotos: z
    .array(uploadPath)
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
    .array(uploadPath)
    .min(1)
    .max(8),
});

export const retireChangeSchema = z.object({
  type: z.literal("retire"),
  key: changeKey,
  id,
});
export const restoreChangeSchema = z.object({
  type: z.literal("restore"),
  key: changeKey,
  id,
});

export const collectionChangeSchema = z.discriminatedUnion("type", [
  styleOverrideSchema.extend({ type: z.literal("style-override"), key: changeKey }),
  styleCreateSchema.extend({ type: z.literal("style-create"), key: changeKey }),
  retireChangeSchema,
  restoreChangeSchema,
]);

export const galleryWorkSchema = z.object({
  src: uploadPath,
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  category: z.enum(["runway", "commissions", "bridal", "accessories", "press", "workroom"]),
  caption: z.string().trim().max(200),
});
export const galleryChangeSchema = z.discriminatedUnion("type", [
  galleryWorkSchema.extend({ type: z.literal("work-add"), key: changeKey }),
  z.object({ type: z.literal("work-visibility"), key: changeKey, id, hidden: z.boolean() }),
  retireChangeSchema,
  restoreChangeSchema,
]);

export const fabricSchema = z.object({
  name: z.string().trim().min(2).max(40),
  swatchImage: uploadPath,
  averageColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  prices: z
    .object({
      dresses: fabricCents.optional(),
      pants: fabricCents.optional(),
      shirts: fabricCents.optional(),
      heritage: fabricCents.optional(),
    })
    .strict()
    .refine((prices) => Object.keys(prices).length > 0, "at least one category"),
});
export const fabricChangeSchema = z.discriminatedUnion("type", [
  fabricSchema.extend({ type: z.literal("fabric-add"), key: changeKey }),
  retireChangeSchema,
  restoreChangeSchema,
]);

export const priceChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("entry"),
    key: changeKey,
    id: z.string().max(80),
    fixedPrice: cents,
    customizationExtra: cents,
  }),
  z.object({
    type: z.literal("alteration"),
    key: changeKey,
    id: z.string().max(80),
    fixedPrice: cents,
    rushSurcharge: cents,
  }),
  z.object({
    type: z.literal("appointment"),
    key: changeKey,
    id: z.string().max(80),
    fee: cents,
  }),
  retireChangeSchema,
  restoreChangeSchema,
]);

export const shopfrontChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("notice"),
    key: changeKey,
    message: z.string().trim().max(200),
    visible: z.boolean(),
  }),
]);

export const workChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("request-status"),
    key: changeKey,
    kind: z.enum([
      "alteration",
      "order",
      "commission",
      "appointment",
      "contact",
      "premiere-signup",
    ]),
    reference: z.string().trim().min(1).max(40),
    status: z.enum(["new", "answered", "scheduled", "paid", "closed"]),
  }),
  retireChangeSchema,
  restoreChangeSchema,
]);

export const UNDO_KINDS = [
  "style-override",
  "work-visibility",
  "price-entry",
  "alteration",
  "appointment",
  "notice",
  "request-status",
] as const;
export type UndoKind = (typeof UNDO_KINDS)[number];
export const undoQuerySchema = z.object({
  kind: z.enum(UNDO_KINDS),
  id: z.string().trim().min(1).max(80),
});
export type UndoQuery = z.infer<typeof undoQuerySchema>;

export const changesOf = <S extends ZodTypeAny>(schema: S) => z.array(schema).min(1).max(50);

export type CollectionChange = z.infer<typeof collectionChangeSchema>;
export type GalleryChange = z.infer<typeof galleryChangeSchema>;
export type FabricChange = z.infer<typeof fabricChangeSchema>;
export type PriceChange = z.infer<typeof priceChangeSchema>;
export type ShopfrontChange = z.infer<typeof shopfrontChangeSchema>;
export type WorkChange = z.infer<typeof workChangeSchema>;
export type OfficeChange =
  | CollectionChange
  | GalleryChange
  | FabricChange
  | PriceChange
  | ShopfrontChange
  | WorkChange;
