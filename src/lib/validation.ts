import { z } from "zod";
import { alterationServices, appointmentTypes, sizes, styles } from "@/content";

/**
 * One schema per form. Every route handler parses its body through the schema
 * here before anything else happens, so no handler ever sees a shape it did not
 * ask for. Lengths are capped everywhere: an unbounded string is a way to fill
 * someone's disk.
 */

const trimmed = (max: number) => z.string().trim().max(max);

const name = trimmed(80).min(2, "too-short");

const email = trimmed(160).email("invalid-email");

/**
 * Deliberately permissive on format — clients write numbers a dozen ways — but
 * strict on the characters allowed, so nothing that reaches a notification body
 * can carry markup.
 */
const phone = trimmed(30)
  .min(7, "too-short")
  .regex(/^[0-9+()\-.\s]+$/, "invalid-phone");

const message = trimmed(2000);

const locale = z.enum(["es", "en"]);

const contactMethod = z.enum(["whatsapp", "phone", "email"]);

/**
 * A hidden field no person will ever fill in, plus the time the form was
 * rendered. Both are checked in `isLikelyBot` below.
 */
const botCheck = z.object({
  website: z.string().max(0).optional().default(""),
  renderedAt: z.coerce.number().int().nonnegative(),
});

const styleSlugs = styles.map((style) => style.slug) as [string, ...string[]];
const sizeIds = sizes.map((size) => size.id) as ["s", ...("s" | "m" | "l")[]];
const alterationIds = alterationServices.map((item) => item.id) as [string, ...string[]];
const appointmentIds = appointmentTypes.map((item) => item.id) as [string, ...string[]];

const client = z.object({
  name,
  email,
  phone,
  preferredContact: contactMethod,
  locale,
});

/** The alteration request form — the heart of the Demo Day workflow. */
export const alterationRequestSchema = botCheck.extend({
  kind: z.literal("alteration"),
  client,
  garmentDescription: trimmed(500).min(10, "too-short"),
  alterationIds: z.array(z.enum(alterationIds)).min(1).max(8),
  rush: z.boolean().default(false),
  preferredTiming: trimmed(120),
  notes: message.optional().default(""),
  photoDataUrl: z.string().max(6_000_000).optional(),
  acceptedTerms: z.literal(true),
});

/** An order for a piece in the collection, customised or as-cut. */
export const orderRequestSchema = botCheck.extend({
  kind: z.literal("order"),
  client,
  styleSlug: z.enum(styleSlugs),
  sizeId: z.enum(sizeIds),
  customize: z.boolean().default(false),
  notes: message.optional().default(""),
  acceptedTerms: z.literal(true),
});

/** A custom piece, described rather than chosen from the collection. */
export const commissionRequestSchema = botCheck.extend({
  kind: z.literal("commission"),
  client,
  categoryId: trimmed(40),
  fabricId: trimmed(40),
  customize: z.literal(true),
  occasion: trimmed(120),
  neededBy: trimmed(40),
  notes: message.optional().default(""),
  acceptedTerms: z.literal(true),
});

export const requestSchema = z.discriminatedUnion("kind", [
  alterationRequestSchema,
  orderRequestSchema,
  commissionRequestSchema,
]);

export type ClientRequest = z.infer<typeof requestSchema>;

export const appointmentSchema = botCheck.extend({
  client,
  appointmentTypeId: z.enum(appointmentIds),
  /** ISO date, validated against real availability in the route handler. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid-date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "invalid-time"),
  purpose: trimmed(500).min(10, "too-short"),
  acceptedTerms: z.literal(true),
});

export type AppointmentBooking = z.infer<typeof appointmentSchema>;

export const premiereSignupSchema = botCheck.extend({
  email,
  name: name.optional(),
  locale,
  premiereId: trimmed(60),
});

export const contactSchema = botCheck.extend({
  name,
  email,
  phone: phone.optional(),
  locale,
  message: message.min(10, "too-short"),
});

/**
 * Two cheap signals that catch nearly all form spam without putting a puzzle in
 * front of a real client: a field only a script would fill in, and a form
 * submitted faster than a person could type it.
 */
const MINIMUM_HUMAN_SECONDS = 3;

export function isLikelyBot(input: { website?: string; renderedAt: number }): boolean {
  if (input.website && input.website.length > 0) return true;
  const secondsOnForm = (Date.now() - input.renderedAt) / 1000;
  return secondsOnForm < MINIMUM_HUMAN_SECONDS;
}
