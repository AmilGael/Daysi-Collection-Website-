import { z } from "zod";
import { alterationServices, appointmentTypes } from "@/content";

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

export type ContactMethod = z.infer<typeof contactMethod>;

/**
 * A hidden field no person will ever fill in, plus the time the form was
 * rendered. Both are checked in `isLikelyBot` below.
 */
const botCheck = z.object({
  website: z.string().max(0).optional().default(""),
  renderedAt: z.coerce.number().int().nonnegative(),
});

const alterationIds = alterationServices.map((item) => item.id) as [string, ...string[]];
const appointmentIds = appointmentTypes.map((item) => item.id) as [string, ...string[]];

/**
 * Who a request or an order comes from. Only the email is required — an
 * account is made from it silently — so a guest who leaves no name and no
 * phone is still a client Daysi can write back to. A phone number is what
 * unlocks WhatsApp or a call as the reply method; see `resolvePreferredContact`,
 * which every route calls to turn the choice below into one that is actually
 * reachable.
 */
export const clientSchema = z.object({
  // `.optional().default("")` alone would re-validate the substituted "" against
  // `name`'s own `min(2)`, refusing exactly the guest this is meant to admit — a
  // missing name has to become "" after that check runs, not before it, so the
  // fallback is a transform rather than a default.
  name: name.optional().transform((value) => value ?? ""),
  email,
  phone: phone.optional(),
  preferredContact: contactMethod.optional(),
  locale,
});

/** The alteration request form — the heart of the Demo Day workflow. */
export const alterationRequestSchema = botCheck.extend({
  kind: z.literal("alteration"),
  client: clientSchema,
  garmentDescription: trimmed(500).min(10, "too-short"),
  alterationIds: z.array(z.enum(alterationIds)).min(1).max(8),
  rush: z.boolean().default(false),
  preferredTiming: trimmed(120),
  notes: message.optional().default(""),
  photoDataUrl: z.string().max(6_000_000).optional(),
  acceptedTerms: z.literal(true),
});

/** A custom piece, described rather than chosen from the collection. */
export const commissionRequestSchema = botCheck.extend({
  kind: z.literal("commission"),
  client: clientSchema,
  categoryId: trimmed(40),
  fabricId: trimmed(40),
  customize: z.literal(true),
  occasion: trimmed(120),
  neededBy: trimmed(40),
  notes: message.optional().default(""),
  acceptedTerms: z.literal(true),
});

/**
 * What the request form takes. A piece from the collection is not among
 * them: it is bought through the cart, and only a paid checkout becomes an
 * order. Made to measure is the cart's `customize` flag.
 */
export const requestSchema = z.discriminatedUnion("kind", [
  alterationRequestSchema,
  commissionRequestSchema,
]);

export type ClientRequest = z.infer<typeof requestSchema>;

export const appointmentSchema = botCheck.extend({
  client: clientSchema,
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
 * Turns whatever a form sent for "how should Daysi reply" into a method she
 * can actually use, and refuses the two that need a phone when the guest
 * left none. A choice the form never asked about — undefined — falls back to
 * WhatsApp for whoever left a number and email for whoever did not, so an
 * email-only guest is never silently assigned a contact method nobody can
 * reach them by.
 */
export function resolvePreferredContact(details: {
  phone?: string;
  preferredContact?: ContactMethod;
}): { preferredContact: ContactMethod } | null {
  const preferredContact = details.preferredContact ?? (details.phone ? "whatsapp" : "email");
  if ((preferredContact === "whatsapp" || preferredContact === "phone") && !details.phone) {
    return null;
  }
  return { preferredContact };
}

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
