import { MEASUREMENTS, type MeasurementId } from "@/content/measurements";

/** A client picks the unit their tape shows; each number is kept with it. */
export type Unit = "in" | "cm";
export const UNITS = ["in", "cm"] as const satisfies readonly Unit[];

const CM_PER_INCH = 2.54;

export function toCm(value: number, unit: Unit): number {
  return unit === "cm" ? value : value * CM_PER_INCH;
}

export function withinRange(id: MeasurementId, value: number, unit: Unit): boolean {
  const definition = MEASUREMENTS.find((m) => m.id === id);
  if (!definition || !Number.isFinite(value)) return false;
  const cm = toCm(value, unit);
  return cm >= definition.rangeCm[0] && cm <= definition.rangeCm[1];
}

/**
 * A reading as the `to` side of the tape shows it: to the half inch or the
 * whole centimetre. Always from the number as it was taken, never from an
 * earlier conversion: 82 cm is 32.5 in, and 32.5 in is 83 cm.
 */
export function convertMeasurement(value: number, from: Unit, to: Unit): number {
  const exact = from === to ? value : to === "cm" ? value * CM_PER_INCH : value / CM_PER_INCH;
  return to === "cm" ? Math.round(exact) : Math.round(exact * 2) / 2;
}

function plain(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** "32 in · 81 cm": what Daysi reads, so nobody converts in their head. */
export function bothUnits(value: number, unit: Unit): string {
  return `${plain(convertMeasurement(value, unit, "in"))} in · ${convertMeasurement(value, unit, "cm")} cm`;
}

/** The size guide already speaks inches in English and centimetres in Spanish. */
export function defaultUnit(locale: "es" | "en"): Unit {
  return locale === "en" ? "in" : "cm";
}
