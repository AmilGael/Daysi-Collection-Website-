import { randomBytes } from "node:crypto";
import { MEASUREMENTS, type MeasurementId } from "@/content/measurements";
import { normaliseEmail } from "./auth/accounts";
import type { Unit } from "./measurements";
import type { ClientChange } from "./office-validation";
import { appendRecord, latestBy, readRecords, rewriteRecords, versionsOf } from "./records";

/**
 * Client cards: what Daysi used to keep on paper, filed by name. One card
 * per client, written by the client from their account or by Daysi from the
 * office, never by an order or a payment.
 *
 * Append-only and latest-by-id, like every collection, except for the one
 * erasure `clearClientEntries` owes a client. Not signed: signing uses
 * AUTH_SECRET, and rotating that secret after an incident would make every
 * signed line look tampered and silently empty the book. A planted line
 * here grants no access to anything; a lost book cannot be rebuilt.
 */
export const CLIENT_CARDS = "client-cards";

export type Measurement = {
  readonly value: number;
  readonly unit: Unit;
  /** Daysi's numbers win: a client save never overwrites one she took. */
  readonly by: "client" | "daysi";
  readonly at: string;
};
export type Measurements = Readonly<Partial<Record<MeasurementId, Measurement>>>;
export type Address = {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
};
export type PreferredContact = "whatsapp" | "phone" | "email";

export type ClientCard = {
  readonly id: string;
  readonly accountId?: string;
  readonly name: string;
  /** Normalised. For an account holder, always the account's own address. */
  readonly email?: string;
  readonly phone?: string;
  readonly preferredContact?: PreferredContact;
  readonly address?: Address;
  readonly measurements: Measurements;
  /** The client's, visible to both. */
  readonly notes?: string;
  /** Daysi's, never sent to the client. */
  readonly ownerNote?: string;
  readonly archived?: boolean;
  readonly updatedAt: string;
  readonly updatedBy: "client" | "office";
};

export type MeasurementInput = { readonly value: number; readonly unit: Unit };
export type ClientCardInput = {
  readonly name: string;
  readonly phone?: string;
  readonly preferredContact?: PreferredContact;
  readonly address?: Address;
  readonly measurements: Readonly<Partial<Record<MeasurementId, MeasurementInput>>>;
  readonly notes?: string;
};

type AccountRef = { readonly id: string; readonly email: string; readonly name?: string };

let chain: Promise<unknown> = Promise.resolve();

/**
 * One write at a time. There is one machine and one process, so a promise
 * chain in this module is the whole of it, as with the checkout lock. The
 * erase in `clearClientEntries` depends on it: an append between its read
 * and its rename would be lost.
 */
export function withCardLock<T>(work: () => Promise<T>): Promise<T> {
  const run = chain.then(work, work);
  chain = run.catch(() => undefined);
  return run;
}

export function newCardId(): string {
  return `cli_${randomBytes(12).toString("base64url")}`;
}

export function listClientCards(): ClientCard[] {
  return latestBy(readRecords<ClientCard>(CLIENT_CARDS), (card) => card.id);
}

export function findClientCard(id: string): ClientCard | undefined {
  return listClientCards().find((card) => card.id === id);
}

export function cardForEmail(email: string): ClientCard | undefined {
  const wanted = normaliseEmail(email);
  return wanted ? listClientCards().find((card) => card.email === wanted) : undefined;
}

/**
 * The account's card: by the account id once the client has saved it,
 * otherwise a card Daysi made under the same address, which the client's
 * first save then adopts.
 */
export function cardForAccount(account: AccountRef): ClientCard | undefined {
  const cards = listClientCards();
  const email = normaliseEmail(account.email);
  return (
    cards.find((card) => card.accountId === account.id) ??
    cards.find((card) => card.accountId === undefined && card.email === email)
  );
}

export function measuredCount(card: ClientCard | undefined): number {
  if (!card) return 0;
  return MEASUREMENTS.filter((m) => card.measurements[m.id] !== undefined).length;
}

/** Digits only, with a US country code dropped, so one number matches however it was typed. */
export function phoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/** What the site's forms start with for a signed-in client. */
export function knownContact(account: AccountRef): { name: string; email: string; phone: string } {
  const card = cardForAccount(account);
  return {
    name: card?.name || account.name || "",
    email: normaliseEmail(account.email),
    phone: card?.phone ?? "",
  };
}

export function saveClientCard(
  account: AccountRef,
  input: ClientCardInput,
  now: Date = new Date(),
): Promise<ClientCard> {
  return withCardLock(async () => {
    const existing = cardForAccount(account);
    const at = now.toISOString();
    const measurements: Partial<Record<MeasurementId, Measurement>> = {};
    for (const { id } of MEASUREMENTS) {
      const kept = existing?.measurements[id];
      if (kept?.by === "daysi") {
        measurements[id] = kept;
        continue;
      }
      const given = input.measurements[id];
      if (!given) continue;
      measurements[id] =
        kept && kept.value === given.value && kept.unit === given.unit
          ? kept
          : { value: given.value, unit: given.unit, by: "client", at };
    }

    const card: ClientCard = {
      id: existing?.id ?? newCardId(),
      accountId: account.id,
      name: input.name,
      email: normaliseEmail(account.email),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.preferredContact ? { preferredContact: input.preferredContact } : {}),
      ...(input.address ? { address: input.address } : {}),
      measurements,
      ...(input.notes ? { notes: input.notes } : {}),
      ...(existing?.ownerNote ? { ownerNote: existing.ownerNote } : {}),
      ...(existing?.archived ? { archived: true } : {}),
      updatedAt: at,
      updatedBy: "client",
    };
    await appendRecord(CLIENT_CARDS, card);
    return card;
  });
}

/**
 * "Borrar lo que escribí" (erase what I typed): the address, the notes and the client's own
 * measurements go, and so do all the card's older lines, so the address is
 * gone from the file rather than superseded. Daysi's measurements, her note,
 * the name and the phone stay: they are the shop's record of the work.
 * Volume snapshots keep the old file until they expire (30 days).
 */
export function clearClientEntries(
  account: AccountRef,
  now: Date = new Date(),
): Promise<ClientCard | undefined> {
  return withCardLock(async () => {
    const existing = cardForAccount(account);
    if (!existing) return undefined;
    const kept: Partial<Record<MeasurementId, Measurement>> = {};
    for (const { id } of MEASUREMENTS) {
      const measurement = existing.measurements[id];
      if (measurement?.by === "daysi") kept[id] = measurement;
    }
    const cleared: ClientCard = {
      id: existing.id,
      accountId: account.id,
      name: existing.name,
      email: normaliseEmail(account.email),
      ...(existing.phone ? { phone: existing.phone } : {}),
      ...(existing.preferredContact ? { preferredContact: existing.preferredContact } : {}),
      measurements: kept,
      ...(existing.ownerNote ? { ownerNote: existing.ownerNote } : {}),
      ...(existing.archived ? { archived: true } : {}),
      updatedAt: now.toISOString(),
      updatedBy: "client",
    };
    await rewriteRecords<ClientCard>(CLIENT_CARDS, (record) => record.id !== existing.id);
    await appendRecord(CLIENT_CARDS, cleared);
    return cleared;
  });
}

/** Why an office write on a card was refused: see each call site. */
export class CardRefused extends Error {
  constructor(readonly code: "taken" | "locked-email" | "unknown-card") {
    super(code);
  }
}

type SaveWire = Extract<ClientChange, { type: "client-save" }>;

/**
 * Daysi's own save: a new card without `cardId`, or an update to that id
 * (refused as `unknown-card` when it does not exist). A number she gives
 * that matches what is already on file keeps that entry, `by` and `at`
 * untouched; a different number becomes hers (`by: "daysi"`). `address`,
 * `notes` and `ownerNote` follow the same undefined-keeps / null-removes /
 * value-replaces rule used throughout the office. The email is normalised
 * and must stay unique across cards (`taken`); an account holder's card
 * cannot have its email moved from here (`locked-email`), since that email is
 * the account's own.
 */
export function officeSaveCard(change: SaveWire, now: Date = new Date()): Promise<ClientCard> {
  return withCardLock(async () => {
    const cards = listClientCards();
    const existing = change.cardId ? cards.find((card) => card.id === change.cardId) : undefined;
    if (change.cardId && !existing) throw new CardRefused("unknown-card");

    const email = change.email ? normaliseEmail(change.email) : existing?.email;
    if (existing?.accountId && email !== existing.email) throw new CardRefused("locked-email");
    if (email && cards.some((card) => card.email === email && card.id !== existing?.id)) {
      throw new CardRefused("taken");
    }

    const at = now.toISOString();
    const measurements: Partial<Record<MeasurementId, Measurement>> = { ...(existing?.measurements ?? {}) };
    for (const { id } of MEASUREMENTS) {
      if (!(id in change.measurements)) continue;
      const given = change.measurements[id];
      const kept = existing?.measurements[id];
      if (given === null || given === undefined) {
        delete measurements[id];
      } else if (!(kept && kept.value === given.value && kept.unit === given.unit)) {
        measurements[id] = { value: given.value, unit: given.unit, by: "daysi", at };
      }
    }

    const pick = <T,>(value: T | null | undefined, previous: T | undefined) =>
      value === null ? undefined : value === undefined ? previous : value;
    const address = pick(change.address, existing?.address);
    const notes = pick(change.notes, existing?.notes);
    const ownerNote = pick(change.ownerNote, existing?.ownerNote);
    const phone = change.phone ?? existing?.phone;
    const preferredContact = change.preferredContact ?? existing?.preferredContact;

    const card: ClientCard = {
      id: existing?.id ?? newCardId(),
      ...(existing?.accountId ? { accountId: existing.accountId } : {}),
      name: change.name,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(preferredContact ? { preferredContact } : {}),
      ...(address ? { address } : {}),
      measurements,
      ...(notes ? { notes } : {}),
      ...(ownerNote ? { ownerNote } : {}),
      ...(existing?.archived ? { archived: true } : {}),
      updatedAt: at,
      updatedBy: "office",
    };
    await appendRecord(CLIENT_CARDS, card);
    return card;
  });
}

/** Sets or clears the archive mark on a card (`unknown-card` when it does not exist). */
export function officeArchiveCard(id: string, archived: boolean, now: Date = new Date()): Promise<void> {
  return withCardLock(async () => {
    const existing = findClientCard(id);
    if (!existing) throw new CardRefused("unknown-card");
    const { archived: _previous, ...rest } = existing;
    await appendRecord(CLIENT_CARDS, {
      ...rest,
      ...(archived ? { archived: true } : {}),
      updatedAt: now.toISOString(),
      updatedBy: "office",
    } satisfies ClientCard);
  });
}

/** Undo: a version re-appended as it was, so a client's measurement stays the client's. */
export function officeRevertCard(id: string, to: string, now: Date = new Date()): Promise<void> {
  return withCardLock(async () => {
    const version = versionsOf<ClientCard>(CLIENT_CARDS, (card) => card.id, id).find((card) => card.updatedAt === to);
    if (!version) throw new CardRefused("unknown-card");
    await appendRecord(CLIENT_CARDS, { ...version, updatedAt: now.toISOString(), updatedBy: "office" } satisfies ClientCard);
  });
}
