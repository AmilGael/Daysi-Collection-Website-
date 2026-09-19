import { MEASUREMENTS, type MeasurementId } from "@/content/measurements";
// Types only: client-book.ts and client-cards.ts read the store and must never reach the browser.
import type { BookRow } from "@/lib/client-book";
import type { Address, ClientCard } from "@/lib/client-cards";
import { withinRange, type Unit } from "@/lib/measurements";
import { clientSaveSchema, normalizePhone, type ClientChange } from "@/lib/office-validation";
import type { Locale } from "@/i18n/routing";
import type { AddressFields } from "../client-card-draft";

/**
 * The Clientes tab's pure half: which rows a search finds, and what one
 * client's sheet stages. Kept out of the components so it can be tested
 * without a browser, as the office's other drafts are.
 *
 * A sheet stages one `client-save` carrying only what Daysi changed. A
 * measurement she did not touch is left off the wire, so it keeps its owner
 * and its date; one she typed is sent in the unit she typed it in; one she
 * removed is `null`. Anything the server would refuse (a number out of
 * range, an email that is not one, a name too short) is left off too and
 * shown on the sheet instead: one bad box must never hold back the rest of
 * the draft, which the server accepts or refuses as a whole.
 */

/** A card as the office page hands it over: without the account id or who wrote it last. */
export type OfficeCard = Omit<ClientCard, "accountId" | "updatedBy">;
/** A row of the book as the Clientes tab receives it. */
export type OfficeBookRow = Omit<BookRow, "card"> & { readonly card?: OfficeCard };

type SaveWire = Extract<ClientChange, { type: "client-save" }>;

/** What the sheet reads of a row: an `OfficeBookRow`, or a new client that is only a key so far. */
export type SheetRow = {
  readonly key: string;
  readonly cardId?: string;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly card?: {
    readonly name: string;
    readonly email?: string;
    readonly phone?: string;
    readonly address?: Address;
    readonly ownerNote?: string;
    readonly measurements: Readonly<Partial<Record<MeasurementId, { readonly value: number; readonly unit: string }>>>;
  };
};

/** One client's sheet, as she has it on screen. */
export type ClientSheetForm = {
  /** The draft key a new card stages under, fixed when its sheet first opens. */
  readonly key?: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  /** Absent: not touched. `null`: no address, which removes one on file. */
  readonly address?: AddressFields | null;
  /** The unit the boxes show. */
  readonly unit: Unit;
  /** What she typed in each box. A box she has not typed in is absent or empty. */
  readonly values: Readonly<Partial<Record<MeasurementId, string>>>;
  /** The unit each box was typed in, when that is not `unit`: the switch only changes what the boxes show. */
  readonly units?: Readonly<Partial<Record<MeasurementId, Unit>>>;
  readonly removed: ReadonlySet<string>;
  readonly ownerNote: string;
};

export type SheetProblem = "name" | "email" | "phone" | "address" | MeasurementId;

/** The draft key for a card on file; a new card's is `client:new-…`, made once per sheet. */
export const cardKey = (cardId: string) => `client:${cardId}`;
export const archiveKey = (cardId: string) => `client-archive:${cardId}`;
export const newClientKey = () => `client:new-${crypto.randomUUID()}`;

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const digitsOf = (text: string) => text.replace(/\D/g, "");

/** Digits only, with a US country code dropped, as the book matches a phone. */
function phoneDigits(phone: string): string {
  const digits = digitsOf(phone);
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/**
 * The rows a search finds. Accents and case are folded away, so "perez"
 * finds "Pérez"; a word of digits also finds a phone however it was
 * written, so "555 0101" finds "(718) 555-0101". Every word has to appear,
 * in any order. An empty search finds everyone.
 */
export function filterRows<R extends { readonly name: string; readonly email?: string; readonly phone?: string }>(
  rows: readonly R[],
  query: string,
): R[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((row) => {
    const text = fold(`${row.name} ${row.email ?? ""} ${row.phone ?? ""}`);
    const digits = row.phone ? phoneDigits(row.phone) : "";
    return words.every((word) => {
      if (text.includes(word)) return true;
      if (!digits || !/^[\d()+.-]+$/.test(word)) return false;
      const typed = digitsOf(word);
      return typed.length > 0 && (digits.includes(typed) || (typed.length > 1 && typed.startsWith("1") && digits.includes(typed.slice(1))));
    });
  });
}

/** "30,5" and "30.5" are one number: a phone set to Spanish offers the comma. */
function readNumber(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  return /^(\d+(\.\d*)?|\.\d+)$/.test(cleaned) ? Number(cleaned) : null;
}

/** An address from its boxes, or `null` when every box that makes one is empty. */
function addressOf(fields: AddressFields | null): Address | null {
  if (!fields) return null;
  const line1 = fields.line1.trim();
  const line2 = fields.line2.trim();
  const city = fields.city.trim();
  const state = fields.state.trim();
  const zip = fields.zip.trim();
  // The state starts filled in, so it alone does not make an address.
  if (!line1 && !line2 && !city && !zip) return null;
  return { line1, ...(line2 ? { line2 } : {}), city, state, zip };
}

function sameAddress(a: Address | null, b: Address | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.line1 === b.line1 && (a.line2 ?? "") === (b.line2 ?? "") && a.city === b.city && a.state === b.state && a.zip === b.zip;
}

const unitOf = (form: ClientSheetForm, id: MeasurementId): Unit => form.units?.[id] ?? form.unit;

/** Every box the server would refuse as it stands, checked by the schema's own rules. */
export function sheetProblems(form: ClientSheetForm): SheetProblem[] {
  const shape = clientSaveSchema.shape;
  const problems: SheetProblem[] = [];
  if (!shape.name.safeParse(form.name).success) problems.push("name");
  if (form.email.trim() && !shape.email.safeParse(form.email.trim()).success) problems.push("email");
  if (form.phone.trim() && !shape.phone.safeParse(form.phone).success) problems.push("phone");
  const address = form.address === undefined ? null : addressOf(form.address);
  if (address && !shape.address.safeParse(address).success) problems.push("address");
  for (const { id } of MEASUREMENTS) {
    const text = form.values[id]?.trim();
    if (!text || form.removed.has(id)) continue;
    const value = readNumber(text);
    if (value === null || !withinRange(id, value, unitOf(form, id))) problems.push(id);
  }
  return problems;
}

/**
 * The one `client-save` a sheet stands for: only what changed, and none of
 * what `sheetProblems` would refuse. A row with no card yet makes one, under
 * the sheet's own `client:new-…` key, carrying the contact it shows.
 */
export function saveWire(row: SheetRow, form: ClientSheetForm): ClientChange {
  const problems = new Set(sheetProblems(form));
  const card = row.card;

  const name = problems.has("name") ? (card?.name ?? row.name) : form.name.trim();
  const email = problems.has("email") ? "" : form.email.trim().toLowerCase();
  const phone = problems.has("phone") ? "" : normalizePhone(form.phone).trim();
  const sendEmail = email && email !== (card?.email ?? "");
  const sendPhone = phone && phone !== (card?.phone ?? "");

  let address: Address | null | undefined;
  if (form.address !== undefined && !problems.has("address")) {
    const next = addressOf(form.address);
    if (!sameAddress(next, card?.address)) address = next;
  }

  const note = form.ownerNote.trim();
  const ownerNote = note === (card?.ownerNote ?? "") ? undefined : note || null;

  const measurements: SaveWire["measurements"] = {};
  for (const { id } of MEASUREMENTS) {
    if (form.removed.has(id)) {
      measurements[id] = null;
      continue;
    }
    const text = form.values[id]?.trim();
    if (!text || problems.has(id)) continue;
    const value = readNumber(text);
    if (value === null) continue;
    const unit = unitOf(form, id);
    const kept = card?.measurements[id];
    if (kept && kept.value === value && kept.unit === unit) continue;
    measurements[id] = { value, unit };
  }

  return {
    type: "client-save",
    key: row.cardId ? cardKey(row.cardId) : (form.key ?? newClientKey()),
    ...(row.cardId ? { cardId: row.cardId } : {}),
    name,
    ...(sendEmail ? { email } : {}),
    ...(sendPhone ? { phone } : {}),
    ...(address !== undefined ? { address } : {}),
    measurements,
    ...(ownerNote !== undefined ? { ownerNote } : {}),
  };
}

/**
 * What the sheet should hold in the draft right now: its `client-save`, or
 * `null` when confirming it would change nothing (or, for a new client, when
 * there is no name to file them under yet), so the entry can leave the draft.
 */
export function stagedChange(row: SheetRow, form: ClientSheetForm): SaveWire | null {
  const wire = saveWire(row, form);
  if (wire.type !== "client-save" || !clientSaveSchema.shape.name.safeParse(wire.name).success) return null;
  if (Object.keys(wire.measurements).length > 0 || wire.address !== undefined || wire.ownerNote !== undefined) return wire;
  const shown = {
    name: row.card?.name ?? row.name,
    email: row.card?.email ?? row.email ?? "",
    phone: row.card?.phone ?? row.phone ?? "",
  };
  const changed =
    wire.name !== shown.name ||
    (wire.email !== undefined && wire.email !== shown.email.toLowerCase()) ||
    (wire.phone !== undefined && wire.phone !== normalizePhone(shown.phone).trim());
  return changed ? wire : null;
}

/** The sheet as it opens on a row: its contact and address as filed, every box empty. */
export function startingForm(row: SheetRow, unit: Unit, key?: string): ClientSheetForm {
  const card = row.card;
  const address = card?.address;
  return {
    ...(key ? { key } : {}),
    name: card?.name ?? row.name,
    email: card?.email ?? row.email ?? "",
    phone: card?.phone ?? row.phone ?? "",
    address: address ? { ...address, line2: address.line2 ?? "" } : null,
    unit,
    values: {},
    removed: new Set(),
    ownerNote: card?.ownerNote ?? "",
  };
}

/** What a sheet keeps beside its staged change, so reopening it shows what she typed. */
export type SheetMeta = { readonly rowKey: string; readonly form: ClientSheetForm };

export function sheetMetaOf(meta: unknown): SheetMeta | undefined {
  return typeof meta === "object" && meta !== null && "rowKey" in meta && "form" in meta ? (meta as SheetMeta) : undefined;
}

const SHOP_ZONE = "America/New_York";
const yearOf = (date: Date) => new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: SHOP_ZONE }).format(date);

/** "3 sep", or "3 sep 2025" for a day in another year, on the shop's own calendar. */
export function shortDate(iso: string, locale: Locale, now: Date = new Date()): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "short",
    ...(yearOf(date) !== yearOf(now) ? { year: "numeric" } : {}),
    timeZone: SHOP_ZONE,
  }).format(date);
}
