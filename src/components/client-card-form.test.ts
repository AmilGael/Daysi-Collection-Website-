import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { formPayload, switchUnit } from "./client-card-form";

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
      values: { bust: "", waist: "30,5", hips: "40", inseam: "", height: "" },
      locked: new Set(["hips"]),
    });
    expect(payload).toEqual({ name: "Ana", measurements: { waist: { value: 30.5, unit: "in" } } });
  });

  it("sends the address only when it is open and filled", () => {
    const payload = formPayload({
      name: "Ana", phone: "718 555 0101", preferredContact: "whatsapp", addressOpen: true,
      address: { line1: "1 Grand Concourse", line2: "", city: "Bronx", state: "NY", zip: "10451" },
      notes: "hombro", unit: "cm", values: { bust: "", waist: "", hips: "", inseam: "", height: "" }, locked: new Set(),
    });
    expect(payload).toEqual({
      name: "Ana", phone: "718 555 0101", preferredContact: "whatsapp",
      address: { line1: "1 Grand Concourse", city: "Bronx", state: "NY", zip: "10451" },
      notes: "hombro", measurements: {},
    });
  });
});

describe("the rest of what the card form sends", () => {
  const blank = {
    name: "Ana",
    phone: "",
    preferredContact: null,
    addressOpen: false,
    address: { line1: "", line2: "", city: "", state: "", zip: "" },
    notes: "",
    unit: "cm" as const,
    values: { bust: "", waist: "", hips: "", inseam: "", height: "" },
    locked: new Set<never>(),
  };

  it("leaves out an address that was opened but not filled in", () => {
    const payload = formPayload({ ...blank, addressOpen: true, address: { line1: "", line2: "", city: "", state: "NY", zip: "" } });
    expect(payload).toEqual({ name: "Ana", measurements: {} });
  });

  it("does not ask for WhatsApp or a call when there is no number to use", () => {
    expect(formPayload({ ...blank, preferredContact: "whatsapp" })).toEqual({ name: "Ana", measurements: {} });
    expect(formPayload({ ...blank, preferredContact: "email" })).toEqual({ name: "Ana", preferredContact: "email", measurements: {} });
  });

  it("sends every measurement the client still has, not only the ones they changed", () => {
    const payload = formPayload({ ...blank, values: { bust: "90", waist: " 72.5 ", hips: "", inseam: "76", height: "160" } });
    expect(Object.keys(payload.measurements).sort()).toEqual(["bust", "height", "inseam", "waist"]);
    expect(payload.measurements.waist).toEqual({ value: 72.5, unit: "cm" });
  });

  it("never drops a number it cannot read, so the one on file is not erased by a typo", () => {
    const payload = formPayload({ ...blank, values: { ...blank.values, waist: "treinta" } });
    expect(payload.measurements.waist?.value).toBeNaN();
  });
});

describe("switching between inches and centimetres", () => {
  const values = { bust: "", waist: "81", hips: "40,5", inseam: "abc", height: "160" };

  it("converts every number the client typed, rounded to half an inch or a whole centimetre", () => {
    const inches = switchUnit(values, new Set(), "cm", "in");
    expect(inches).toEqual({ bust: "", waist: "32", hips: "16", inseam: "abc", height: "63" });
    expect(switchUnit({ ...values, waist: "30.5" }, new Set(), "in", "cm").waist).toBe("77");
  });

  it("leaves Daysi's numbers alone, and does nothing when the unit stays", () => {
    expect(switchUnit(values, new Set(["waist"]), "cm", "in").waist).toBe("81");
    expect(switchUnit(values, new Set(), "cm", "cm")).toEqual(values);
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
