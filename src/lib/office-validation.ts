import { z } from "zod";
import { categories, shopDay } from "@/content";
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
export const changeKey = z.string().regex(/^[a-z-]+:[A-Za-z0-9._:-]+$/).max(120);
const cents = z.number().int().min(0).max(5_000_00);
const fabricCents = z.number().int().min(1_00).max(5_000_00);
/** A garment's own price: at least a dollar, like a fabric's, so a slip of the thumb is not a sale. */
const ownPriceCents = z.number().int().min(1_00).max(5_000_00);
const id = z.string().trim().min(1).max(60);

/** A field Daysi fills in both languages. The English box is pre-filled from
 *  the Spanish as she types, so neither side is ever blank by accident. */
const pair = (min: number, max: number) =>
  z.object({
    es: z.string().trim().min(min).max(max),
    en: z.string().trim().min(min).max(max),
  });

/** Pieces of one size on the rack, or the older on/off switch for a size never counted. */
const sizeStock = z.union([z.boolean(), z.number().int().min(0).max(99)]);
const countedAt = z.string().datetime();

export const styleOverrideSchema = z.object({
  styleId: z.string().trim().min(1).max(60),
  isPublished: z.boolean(),
  stock: z
    .object({ s: sizeStock.optional(), m: sizeStock.optional(), l: sizeStock.optional() })
    .strict(),
  /** When each count was taken. Only an undo sends it; a typed count is stamped on arrival. */
  countedAt: z
    .object({ s: countedAt.optional(), m: countedAt.optional(), l: countedAt.optional() })
    .strict()
    .optional(),
  addedPhotos: z
    .array(uploadPath)
    .max(12)
    .optional(),
  coverSrc: z.string().max(200).optional(),
  /** The full photo order, cover first: a coded src or an upload path each. Absent keeps the older rule. */
  photos: z
    .array(z.string().trim().min(1).max(200).regex(/^\/(images|uploads)\/[A-Za-z0-9._/-]+\.(jpg|jpeg|png|webp)$/))
    .min(1)
    .max(12)
    .optional(),
  inStudio: z.boolean().optional(),
  /** The garment's own price. Absent puts the list price back: the newest record is the whole truth. */
  fixedPrice: ownPriceCents.optional(),
  /** Its own made-to-measure extra, read only beside fixedPrice. Absent = the list's extra. */
  customizationExtra: cents.optional(),
});

/** Typed in Spanish only; the action writes the English (design, Amendment 4 §5). */
export const styleCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(10).max(400),
  detail: z.string().trim().max(400),
  color: z.string().trim().max(80),
  categoryId: z.enum(categories.map((category) => category.id) as [string, ...string[]]),
  fabricId: z.string().trim().min(1).max(60),
  /**
   * For a pair with no published price, the price that goes on the list; for
   * a priced pair, this garment's own price beside the list (which stays).
   */
  fixedPrice: z.number().int().min(0).max(5_000_00).optional(),
  /** The made-to-measure extra that goes with fixedPrice, on the list or the garment. */
  customizationExtra: cents.optional(),
  sizes: z.object({ s: sizeStock, m: sizeStock, l: sizeStock }).strict(),
  photos: z
    .array(uploadPath)
    .min(1)
    .max(8),
  inStudio: z.boolean().default(false),
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

/** Field limits mirror styleCreateSchema and galleryWorkSchema, so a correction
 *  can never be longer than the words it replaces were allowed to be. */
export const TEXT_LIMITS = {
  name: 60,
  color: 80,
  description: 400,
  detail: 400,
  caption: 200,
} as const;

const localeField = z.enum(["es", "en"]);

/** An empty value is the clear: it returns the field to the coded words. */
const textValue = <F extends keyof typeof TEXT_LIMITS>(field: F) =>
  z.string().trim().max(TEXT_LIMITS[field]);

/**
 * One flat object, not a refinement: `z.discriminatedUnion` refuses a
 * `ZodEffects` member, and turning the collection union into a plain `z.union`
 * would cost the discriminated error messages every other change type relies
 * on. The outer bound here is the longest field; the exact per-field limit is
 * enforced in the action, where every other refusal already lives.
 */
export const styleTextSchema = z.object({
  type: z.literal("style-text"),
  key: changeKey,
  id,
  field: z.enum(["name", "color", "description", "detail"]),
  locale: localeField,
  value: z.string().trim().max(400),
});

export const workTextSchema = z.object({
  type: z.literal("work-text"),
  key: changeKey,
  id,
  field: z.literal("caption"),
  locale: localeField,
  value: textValue("caption"),
});

/** "Traducir": write the English for these fields from their current Spanish. */
export const translateChangeSchema = z.object({
  type: z.literal("translate"),
  key: changeKey,
  id,
  fields: z.array(z.enum(["name", "color", "description", "detail"])).min(1).max(4),
});

export const collectionChangeSchema = z.discriminatedUnion("type", [
  styleOverrideSchema.extend({ type: z.literal("style-override"), key: changeKey }),
  styleCreateSchema.extend({ type: z.literal("style-create"), key: changeKey }),
  styleTextSchema,
  translateChangeSchema,
  retireChangeSchema,
  restoreChangeSchema,
]);

export const galleryWorkSchema = z.object({
  src: uploadPath,
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  /**
   * A section id, not an enum: the six coded ones plus whatever Daysi has
   * named through "Otra…". Whether it names a live section is a question
   * for the action, at apply time, the same way a garment's id is (see the
   * comment on `styleOverrideSchema` above).
   */
  category: z.string().trim().min(1).max(60),
  caption: pair(0, 200),
});
export const galleryChangeSchema = z.discriminatedUnion("type", [
  galleryWorkSchema.extend({ type: z.literal("work-add"), key: changeKey }),
  z.object({ type: z.literal("work-visibility"), key: changeKey, id, hidden: z.boolean() }),
  workTextSchema,
  retireChangeSchema,
  restoreChangeSchema,
  /** Typed in Spanish only; the action writes the English and the id. Its
   *  own members, distinct from `retire`/`restore` above, because those two
   *  already mean a work on this tab. */
  z.object({ type: z.literal("section-add"), key: changeKey, name: z.string().trim().min(2).max(40) }),
  z.object({ type: z.literal("section-retire"), key: changeKey, id }),
  z.object({ type: z.literal("section-restore"), key: changeKey, id }),
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

/**
 * Which list a retire or restore on Precios means. Absent is a garment price,
 * which is all the tab could retire before alterations and sessions could be
 * added (and retired) there too.
 */
const priceRetireKind = z.enum(["price-entry", "alteration", "appointment-type"]).optional();

/** An alteration Daysi adds, typed in Spanish only; the action writes the English. */
export const alterationAddSchema = z.object({
  type: z.literal("alteration-add"),
  key: changeKey,
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(160),
  fixedPrice: cents,
  rushSurcharge: cents,
  turnaround: z.string().trim().max(30),
  photo: uploadPath.optional(),
});

/** A session Daysi adds, typed in Spanish only; the action writes the English. */
export const appointmentAddSchema = z.object({
  type: z.literal("appointment-add"),
  key: changeKey,
  name: z.string().trim().min(2).max(60),
  minutes: z.number().int().min(15).max(180),
  fee: cents,
  suitedFor: z.string().trim().max(120),
});

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
  alterationAddSchema,
  appointmentAddSchema,
  retireChangeSchema.extend({ kind: priceRetireKind }),
  restoreChangeSchema.extend({ kind: priceRetireKind }),
]);

export const shopfrontChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("notice"),
    key: changeKey,
    message: z.string().trim().max(200),
    visible: z.boolean(),
  }),
]);

/** A hyphen-like character that is not a plain ASCII "-": the kind autocorrect
 *  or a paste from WhatsApp leaves in a phone number. */
const HYPHEN_LIKE = /[\u2010-\u2015\u2212]/g;
/** Whatever is left once a phone is reduced to what it may actually hold. */
const NOT_A_PHONE_CHARACTER = /[^0-9+()\-.\s]/g;

/**
 * Cleans a phone Daysi jots down by hand or pastes from WhatsApp: every
 * hyphen-like dash becomes a plain "-", then anything that is not a digit, a
 * space, +, (, ), - or . is dropped — a direction mark, a non-breaking space,
 * an emoji. Shared by the sheet, before it ever stages a change, and by the
 * schema below, so the two agree on what a phone is.
 */
export function normalizePhone(value: string): string {
  return value.replace(HYPHEN_LIKE, "-").replace(NOT_A_PHONE_CHARACTER, "");
}

/** A phone Daysi jots down by hand: permissive on format, strict on the
 *  characters allowed, as everywhere else a client's number is taken. */
const notedPhone = z.preprocess(
  (value) => (typeof value === "string" ? normalizePhone(value) : value),
  z.string().trim().min(7).max(30).regex(/^[0-9+()\-.\s]+$/),
).optional();
const notedEmail = z.string().trim().max(160).email().optional();
/** YYYY-MM-DD, no earlier than the site's own records and never in the
 *  future: a typo that says "next year" would misdate a real payment. */
const notedDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => value >= "2020-01-01" && value <= shopDay(new Date()))
  .optional();

/**
 * An order, alteration or custom piece that never touched the site: Daysi
 * took it in person or over WhatsApp, and this is how it still reaches her
 * Hub, her figures and her books. Unlike every other request, the client's
 * name is what she has to give — she typed it herself — while the email
 * that makes an account is the one thing that may be missing.
 */
export const orderNoteSchema = z.object({
  type: z.literal("order-note"),
  key: changeKey,
  kind: z.enum(["order", "alteration", "commission"]),
  clientName: z.string().trim().min(2).max(80),
  phone: notedPhone,
  email: notedEmail,
  description: z.string().trim().max(400),
  amount: cents,
  paid: z.boolean(),
  /** When she took it, if not today. Stamps submittedAt (and paidAt, when
   *  already paid) at noon New York time of that day. */
  date: notedDate,
  notes: z.string().trim().max(400).optional(),
});

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
      "design",
    ]),
    reference: z.string().trim().min(1).max(40),
    status: z.enum(["new", "answered", "scheduled", "paid", "refunded", "closed"]),
  }),
  orderNoteSchema,
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
  "style-text",
  "work-text",
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
