import { describe, expect, it } from "vitest";
import type { MeasurementId } from "@/content/measurements";
import type { Unit } from "@/lib/measurements";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  afterClear,
  formPayload,
  measurementProblems,
  shownText,
  startingState,
  withTyped,
  type CardFormInitial,
  type CardFormState,
  type TypedMeasurement,
} from "./client-card-draft";

/** Every box typed in one unit, as a client who never switched would leave them. */
function typedIn(unit: Unit, texts: Record<MeasurementId, string>): Record<MeasurementId, TypedMeasurement> {
  return Object.fromEntries(Object.entries(texts).map(([id, text]) => [id, { text, unit }])) as Record<
    MeasurementId,
    TypedMeasurement
  >;
}

const NONE = { bust: "", waist: "", hips: "", inseam: "", height: "" };

const blank: CardFormState = {
  name: "Ana",
  phone: "",
  preferredContact: null,
  addressOpen: false,
  address: { line1: "", line2: "", city: "", state: "", zip: "" },
  notes: "",
  unit: "cm",
  values: typedIn("cm", NONE),
  locked: new Set(),
};

describe("what the card form sends", () => {
  it("drops empty fields, reads a comma as a decimal point, and never sends a locked measurement", () => {
    const payload = formPayload({
      name: " Ana ",
      phone: "",
      preferredContact: null,
      addressOpen: false,
      address: { line1: "", line2: "", city: "", state: "", zip: "" },
      notes: "",
      unit: "in",
      values: typedIn("in", { bust: "", waist: "30,5", hips: "40", inseam: "", height: "" }),
      locked: new Set(["hips"]),
    });
    expect(payload).toEqual({ name: "Ana", measurements: { waist: { value: 30.5, unit: "in" } } });
  });

  it("sends the address only when it is open and filled", () => {
    const payload = formPayload({
      name: "Ana", phone: "718 555 0101", preferredContact: "whatsapp", addressOpen: true,
      address: { line1: "1 Grand Concourse", line2: "", city: "Bronx", state: "NY", zip: "10451" },
      notes: "hombro", unit: "cm", values: typedIn("cm", NONE), locked: new Set(),
    });
    expect(payload).toEqual({
      name: "Ana", phone: "718 555 0101", preferredContact: "whatsapp",
      address: { line1: "1 Grand Concourse", city: "Bronx", state: "NY", zip: "10451" },
      notes: "hombro", measurements: {},
    });
  });

  it("leaves out an address that was opened but not filled in", () => {
    const payload = formPayload({ ...blank, addressOpen: true, address: { line1: "", line2: "", city: "", state: "NY", zip: "" } });
    expect(payload).toEqual({ name: "Ana", measurements: {} });
  });

  it("does not ask for WhatsApp or a call when there is no number to use", () => {
    expect(formPayload({ ...blank, preferredContact: "whatsapp" })).toEqual({ name: "Ana", measurements: {} });
    expect(formPayload({ ...blank, preferredContact: "email" })).toEqual({ name: "Ana", preferredContact: "email", measurements: {} });
  });

  it("sends every measurement the client still has, not only the ones they changed", () => {
    const payload = formPayload({ ...blank, values: typedIn("cm", { bust: "90", waist: " 72.5 ", hips: "", inseam: "76", height: "160" }) });
    expect(Object.keys(payload.measurements).sort()).toEqual(["bust", "height", "inseam", "waist"]);
    expect(payload.measurements.waist).toEqual({ value: 72.5, unit: "cm" });
  });

  it("never drops a number it cannot read, so the one on file is not erased by a typo", () => {
    const payload = formPayload({ ...blank, values: { ...blank.values, waist: { text: "treinta", unit: "cm" } } });
    expect(payload.measurements.waist?.value).toBeNaN();
  });
});

describe("switching between inches and centimetres", () => {
  const waist82: CardFormState = { ...blank, values: { ...blank.values, waist: { text: "82", unit: "cm" } } };

  it("shows a conversion of what was typed, so cm to in and back gives the same number", () => {
    const inches: CardFormState = { ...waist82, unit: "in" };
    expect(shownText(inches.values.waist, inches.unit)).toBe("32.5");
    const back: CardFormState = { ...inches, unit: "cm" };
    expect(shownText(back.values.waist, back.unit)).toBe("82");
  });

  it("sends a number the client did not touch in the unit it was typed in, whatever unit is on show", () => {
    expect(formPayload({ ...waist82, unit: "in" }).measurements.waist).toEqual({ value: 82, unit: "cm" });
  });

  it("takes a number typed after switching in the unit on show", () => {
    const retyped = withTyped({ ...waist82, unit: "in" }, "waist", "33");
    expect(formPayload(retyped).measurements.waist).toEqual({ value: 33, unit: "in" });
    expect(shownText(retyped.values.waist, "cm")).toBe("84");
  });

  it("shows text it cannot read as it is, and reads a comma before converting", () => {
    expect(shownText({ text: "abc", unit: "cm" }, "in")).toBe("abc");
    expect(shownText({ text: "40,5", unit: "cm" }, "in")).toBe("16");
    expect(shownText({ text: "", unit: "cm" }, "in")).toBe("");
  });
});

describe("where the form starts", () => {
  const initial: CardFormInitial = {
    name: "Ana",
    email: "ana@example.com",
    phone: "",
    preferredContact: null,
    address: null,
    notes: "",
    measurements: {
      bust: { value: 36, unit: "in", by: "daysi", at: "2026-09-12T15:00:00.000Z" },
      waist: { value: 80, unit: "cm", by: "client", at: "2026-09-10T15:00:00.000Z" },
      hips: { value: 40, unit: "in", by: "client", at: "2026-09-10T15:00:00.000Z" },
    },
  };

  it("shows the unit of the client's own first measurement, then Daysi's, then the language's", () => {
    expect(startingState(initial, "en").unit).toBe("cm");
    expect(startingState({ ...initial, measurements: { bust: initial.measurements.bust } }, "es").unit).toBe("in");
    expect(startingState({ ...initial, measurements: {} }, "en").unit).toBe("in");
    expect(startingState({ ...initial, measurements: {} }, "es").unit).toBe("cm");
  });

  it("starts Daysi's rows blank and never sends them", () => {
    const state = startingState(initial, "es");
    expect(state.locked).toEqual(new Set(["bust"]));
    expect(state.values.bust.text).toBe("");
    expect(formPayload(state).measurements).toEqual({ waist: { value: 80, unit: "cm" }, hips: { value: 40, unit: "in" } });
  });

  it("keeps each of the client's numbers in the unit it was saved in, and shows it in the form's", () => {
    const state = startingState(initial, "es");
    expect(state.values.hips).toEqual({ text: "40", unit: "in" });
    expect(shownText(state.values.hips, state.unit)).toBe("102");
  });

  it("opens the address when the card has one", () => {
    const address = { line1: "1 Grand Concourse", city: "Bronx", state: "NY", zip: "10451" };
    const state = startingState({ ...initial, address }, "es");
    expect(state.addressOpen).toBe(true);
    expect(state.address).toEqual({ ...address, line2: "" });
    expect(startingState(initial, "es").addressOpen).toBe(false);
  });
});

describe("checking the numbers before a save", () => {
  it("names each box it cannot read or that is out of range in the unit it was typed in", () => {
    const state: CardFormState = {
      ...blank,
      unit: "in",
      values: {
        ...typedIn("in", NONE),
        bust: { text: "abc", unit: "in" },
        waist: { text: "82", unit: "cm" },
        hips: { text: "320", unit: "in" },
      },
    };
    expect(measurementProblems(state)).toEqual(["bust", "hips"]);
  });
});

describe("after a clear", () => {
  it("empties the address, the notes and the client's numbers, and keeps the name, the phone and Daysi's rows", () => {
    const state = startingState(
      {
        name: "Ana",
        email: "ana@example.com",
        phone: "718 555 0101",
        preferredContact: "whatsapp",
        address: { line1: "1 Grand Concourse", city: "Bronx", state: "NY", zip: "10451" },
        notes: "hombro",
        measurements: {
          bust: { value: 36, unit: "in", by: "daysi", at: "2026-09-12T15:00:00.000Z" },
          waist: { value: 80, unit: "cm", by: "client", at: "2026-09-10T15:00:00.000Z" },
        },
      },
      "es",
    );
    const cleared = afterClear(state);
    expect(formPayload(cleared)).toEqual({ name: "Ana", phone: "718 555 0101", preferredContact: "whatsapp", measurements: {} });
    expect(cleared.addressOpen).toBe(false);
    expect(cleared.locked).toEqual(new Set(["bust"]));
  });
});

describe("the card page's copy", () => {
  it("has no dashes in either language", () => {
    for (const bundle of [es, en]) {
      const copy = [...Object.values(bundle.clientCard), ...Object.values(bundle.account)].filter(
        (value): value is string => typeof value === "string",
      );
      for (const text of copy) expect(text).not.toMatch(/[—–]/);
    }
  });
});
