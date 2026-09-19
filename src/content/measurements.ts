import type { Localized } from "./types";

/**
 * What a client card measures. Agreed with the user on 19 Sept 2026 as a
 * short list to start from; Daysi's own size table (promised over WhatsApp)
 * will say what else she takes, and adding one is an entry here plus nothing
 * else: the client form, the office sheet and the book all read this list.
 *
 * Ranges are in centimetres and generous on purpose. They exist to catch a
 * typo ("320" for "32"), not to judge a body.
 */
export type MeasurementDefinition = {
  readonly id: string;
  readonly label: Localized;
  readonly howTo: Localized;
  readonly rangeCm: readonly [number, number];
};

export const MEASUREMENTS = [
  {
    id: "bust",
    label: { es: "Busto", en: "Bust" },
    howTo: {
      es: "Alrededor de la parte más llena del pecho, con la cinta derecha por la espalda.",
      en: "Around the fullest part of the chest, with the tape level across the back.",
    },
    rangeCm: [50, 200],
  },
  {
    id: "waist",
    label: { es: "Cintura", en: "Waist" },
    howTo: {
      es: "Alrededor de la parte más angosta de la cintura, sin apretar.",
      en: "Around the narrowest part of the waist, without pulling tight.",
    },
    rangeCm: [40, 200],
  },
  {
    id: "hips",
    label: { es: "Cadera", en: "Hips" },
    howTo: {
      es: "Alrededor de la parte más ancha de la cadera, con los pies juntos.",
      en: "Around the widest part of the hips, with your feet together.",
    },
    rangeCm: [50, 220],
  },
  {
    id: "inseam",
    label: { es: "Entrepierna", en: "Inseam" },
    howTo: {
      es: "Por dentro de la pierna, desde la entrepierna hasta el tobillo.",
      en: "Along the inside of the leg, from the crotch to the ankle.",
    },
    rangeCm: [40, 110],
  },
  {
    id: "height",
    label: { es: "Estatura", en: "Height" },
    howTo: {
      es: "Sin zapatos, de pie contra la pared, desde la cabeza hasta el piso.",
      en: "Without shoes, standing against a wall, from the top of your head to the floor.",
    },
    rangeCm: [90, 230],
  },
] as const satisfies readonly MeasurementDefinition[];

export type MeasurementId = (typeof MEASUREMENTS)[number]["id"];
export const MEASUREMENT_IDS = MEASUREMENTS.map((m) => m.id) as readonly MeasurementId[];
