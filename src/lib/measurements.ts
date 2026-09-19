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

function plain(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** "32 in · 81 cm": what Daysi reads, so nobody converts in their head. */
export function bothUnits(value: number, unit: Unit): string {
  const cm = toCm(value, unit);
  const inches = Math.round((cm / CM_PER_INCH) * 2) / 2;
  return `${plain(inches)} in · ${Math.round(cm)} cm`;
}

/** The size guide already speaks inches in English and centimetres in Spanish. */
export function defaultUnit(locale: "es" | "en"): Unit {
  return locale === "en" ? "in" : "cm";
}
