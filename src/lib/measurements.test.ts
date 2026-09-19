import { describe, expect, it } from "vitest";
import { MEASUREMENTS, MEASUREMENT_IDS } from "@/content/measurements";
import { bothUnits, convertMeasurement, defaultUnit, toCm, withinRange } from "./measurements";

describe("the measurement list", () => {
  it("is the five agreed on 19 Sept 2026, each named and explained in both languages", () => {
    expect(MEASUREMENT_IDS).toEqual(["bust", "waist", "hips", "inseam", "height"]);
    for (const m of MEASUREMENTS) {
      for (const text of [m.label.es, m.label.en, m.howTo.es, m.howTo.en]) {
        expect(text.length).toBeGreaterThan(2);
        expect(text).not.toMatch(/[—–]/);
      }
      expect(m.rangeCm[0]).toBeLessThan(m.rangeCm[1]);
    }
  });
});

describe("units", () => {
  it("converts inches to centimetres and leaves centimetres alone", () => {
    expect(toCm(10, "in")).toBeCloseTo(25.4);
    expect(toCm(81, "cm")).toBe(81);
  });

  it("checks the range after converting, so a typo in either unit is caught", () => {
    expect(withinRange("waist", 30, "in")).toBe(true);
    expect(withinRange("waist", 81, "cm")).toBe(true);
    expect(withinRange("waist", 320, "in")).toBe(false);
    expect(withinRange("waist", 5, "cm")).toBe(false);
    expect(withinRange("waist", Number.NaN, "cm")).toBe(false);
  });

  it("shows both units, to the half inch and the whole centimetre", () => {
    expect(bothUnits(32, "in")).toBe("32 in · 81 cm");
    expect(bothUnits(81, "cm")).toBe("32 in · 81 cm");
    expect(bothUnits(30.5, "in")).toBe("30.5 in · 77 cm");
  });

  it("converts a reading to the other side of the tape, to the half inch or the whole centimetre", () => {
    expect(convertMeasurement(81, "cm", "in")).toBe(32);
    expect(convertMeasurement(82, "cm", "in")).toBe(32.5);
    expect(convertMeasurement(30.5, "in", "cm")).toBe(77);
    expect(convertMeasurement(30.25, "in", "cm")).toBe(77);
    // Converted back from its own rounding, 82 cm would come back as 83:
    // which is why the form always converts from what was typed.
    expect(convertMeasurement(32.5, "in", "cm")).toBe(83);
  });

  it("starts English on inches and Spanish on centimetres", () => {
    expect(defaultUnit("en")).toBe("in");
    expect(defaultUnit("es")).toBe("cm");
  });
});
