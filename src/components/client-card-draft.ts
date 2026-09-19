import { MEASUREMENTS, type MeasurementId } from "@/content/measurements";
import type { Locale } from "@/i18n/routing";
// Types only: client-cards.ts reads the store and must never reach the browser.
import type {
  Address,
  ClientCardInput,
  MeasurementInput,
  Measurements,
  PreferredContact,
} from "@/lib/client-cards";
import { convertMeasurement, defaultUnit, withinRange, type Unit } from "@/lib/measurements";

/**
 * The client card form's state, and what a save sends from it. Kept out of
 * the component so it can be tested without a browser, as the office's
 * drafts are.
 *
 * Each measurement box remembers the text as it was typed (or loaded from
 * the card) and the unit it was typed in. The in/cm switch changes only
 * which unit the boxes show: a box shows a conversion of what was typed,
 * never of an earlier conversion, so switching back and forth cannot move a
 * number. A box the client has not retyped is sent exactly as it was typed,
 * in its own unit, so a save that only looked in the other unit changes
 * nothing on the card.
 *
 * Every other measurement the client still has is sent on every save,
 * because the save replaces the client's numbers with exactly what it
 * receives: one left out is one the client emptied. Daysi's are never sent.
 */

export type AddressFields = {
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
};

/** A measurement box: the text as typed, or as loaded, and the unit it was typed in. */
export type TypedMeasurement = { readonly text: string; readonly unit: Unit };

export type CardFormState = {
  readonly name: string;
  readonly phone: string;
  readonly preferredContact: PreferredContact | null;
  readonly addressOpen: boolean;
  readonly address: AddressFields;
  readonly notes: string;
  /** The unit the boxes show. */
  readonly unit: Unit;
  readonly values: Readonly<Record<MeasurementId, TypedMeasurement>>;
  /** Daysi's: shown as text, never sent. */
  readonly locked: ReadonlySet<MeasurementId>;
};

/** What the page passes in: the viewer's own card, and nothing else of it. */
export type CardFormInitial = {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly preferredContact: PreferredContact | null;
  readonly address: Address | null;
  readonly notes: string;
  readonly measurements: Measurements;
};

export const EMPTY_ADDRESS: AddressFields = { line1: "", line2: "", city: "", state: "", zip: "" };
/** The Bronx is in New York, and so is nearly every client. */
export const HOME_STATE = "NY";

/** "30,5" and "30.5" are one number: a phone set to Spanish offers the comma. */
function readNumber(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  return /^(\d+(\.\d*)?|\.\d+)$/.test(cleaned) ? Number(cleaned) : null;
}

/** What a box shows in `unit`: the text as typed, or a conversion of it. Text it cannot read is shown as it is. */
export function shownText(typed: TypedMeasurement, unit: Unit): string {
  if (typed.unit === unit) return typed.text;
  const value = readNumber(typed.text);
  return value === null ? typed.text : String(convertMeasurement(value, typed.unit, unit));
}

/** The client typed in a box: that text, in the unit on show, replaces what it held. */
export function withTyped(state: CardFormState, id: MeasurementId, text: string): CardFormState {
  return { ...state, values: { ...state.values, [id]: { text, unit: state.unit } } };
}

/** The boxes a save would refuse: text that is not a number, or a number out of range in the unit it was typed in. */
export function measurementProblems(state: CardFormState): MeasurementId[] {
  return MEASUREMENTS.filter(({ id }) => {
    const typed = state.values[id];
    if (state.locked.has(id) || !typed.text.trim()) return false;
    const value = readNumber(typed.text);
    return value === null || !withinRange(id, value, typed.unit);
  }).map(({ id }) => id);
}

/** What a save sends: trimmed, with empty fields left out and Daysi's numbers never included. */
export function formPayload(state: CardFormState): ClientCardInput {
  const phone = state.phone.trim();
  const notes = state.notes.trim();
  // WhatsApp and a call both need a number; without one, only email is a choice.
  const preferredContact =
    state.preferredContact && (phone || state.preferredContact === "email") ? state.preferredContact : null;

  const line1 = state.address.line1.trim();
  const line2 = state.address.line2.trim();
  const city = state.address.city.trim();
  const region = state.address.state.trim();
  const zip = state.address.zip.trim();
  // The state starts filled in, so it alone does not make an address.
  const hasAddress = state.addressOpen && Boolean(line1 || line2 || city || zip);

  const measurements: Partial<Record<MeasurementId, MeasurementInput>> = {};
  for (const { id } of MEASUREMENTS) {
    const typed = state.values[id];
    if (state.locked.has(id) || !typed.text.trim()) continue;
    // A number it cannot read goes as NaN (null on the wire), which the
    // server refuses: dropping it would erase the one on file.
    measurements[id] = { value: readNumber(typed.text) ?? Number.NaN, unit: typed.unit };
  }

  return {
    name: state.name.trim(),
    ...(phone ? { phone } : {}),
    ...(preferredContact ? { preferredContact } : {}),
    ...(hasAddress ? { address: { line1, ...(line2 ? { line2 } : {}), city, state: region, zip } } : {}),
    ...(notes ? { notes } : {}),
    measurements,
  };
}

export function startingState(initial: CardFormInitial, locale: Locale): CardFormState {
  const locked = new Set(MEASUREMENTS.filter((m) => initial.measurements[m.id]?.by === "daysi").map((m) => m.id));
  const kept = MEASUREMENTS.map((m) => initial.measurements[m.id]).filter((m) => m !== undefined);
  // The unit their tape speaks: their own numbers first, then Daysi's, then the language's.
  const unit = (kept.find((m) => m.by === "client") ?? kept[0])?.unit ?? defaultUnit(locale);

  const values = Object.fromEntries(
    MEASUREMENTS.map(({ id }): [MeasurementId, TypedMeasurement] => {
      const measurement = initial.measurements[id];
      if (!measurement || locked.has(id)) return [id, { text: "", unit }];
      return [id, { text: String(measurement.value), unit: measurement.unit }];
    }),
  ) as Record<MeasurementId, TypedMeasurement>;

  return {
    name: initial.name,
    phone: initial.phone,
    preferredContact: initial.preferredContact,
    addressOpen: initial.address !== null,
    address: initial.address ? { ...initial.address, line2: initial.address.line2 ?? "" } : EMPTY_ADDRESS,
    notes: initial.notes,
    unit,
    values,
    locked,
  };
}

/** Whether "Borrar lo que escribí" has anything to clear. */
export function hasOwnEntries(payload: ClientCardInput): boolean {
  return Boolean(payload.address || payload.notes || Object.keys(payload.measurements).length > 0);
}

/** The form after "Borrar lo que escribí", as the server left the card: the name, the phone and Daysi's numbers stay. */
export function afterClear(state: CardFormState): CardFormState {
  return {
    ...state,
    addressOpen: false,
    address: EMPTY_ADDRESS,
    notes: "",
    values: Object.fromEntries(
      MEASUREMENTS.map(({ id }) => [id, state.locked.has(id) ? state.values[id] : { text: "", unit: state.unit }]),
    ) as Record<MeasurementId, TypedMeasurement>,
  };
}
