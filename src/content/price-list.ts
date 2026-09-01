import type { AlterationService, AppointmentType, PriceListEntry } from "./types";

/**
 * ERD: PRICE_LIST_ENTRY — the one price list.
 *
 * Every dollar figure shown anywhere on the site resolves back to this file.
 * Prices are set per garment category and fabric, not per style, so a fabric
 * that gets more expensive is repriced once rather than style by style.
 *
 * They are deliberately set with a cushion for normal swings in material cost
 * (PRD Section 14), which is what makes it honest to publish them as fixed and
 * refuse to negotiate them.
 *
 * August 2026, in two passes. First everything Daysi charges for her own time
 * came down twenty percent — alterations, the rush surcharge, the
 * made-to-measure supplement and the booked sessions — while the garments
 * held. Then, at the end of the month, she took a quarter off the garments
 * themselves: each figure below is the original less 25%, settled down to the
 * nearest five dollars so no price crept back up in the rounding. The labour
 * prices from the first pass did not move again. price-list.test.ts holds
 * both halves.
 */
export const priceList: readonly PriceListEntry[] = [
  entry("dresses", "daisy-cotton", 19500, 7600), // was 26500
  entry("shirts", "wax-print", 12000, 4400), // was 16500
  entry("shirts", "tropical-leaf", 13000, 4400), // was 17500
  entry("shirts", "daisy-cotton", 10500, 4400), // was 14500
  entry("heritage", "wax-print", 29500, 9600), // was 39500
  entry("heritage", "tropical-leaf", 28000, 9600), // was 37500
  entry("heritage", "fish-batik", 29500, 9600), // was 39500
  entry("heritage", "frutera-print", 31500, 9600), // was 42500
  entry("pants", "ocelote-print", 17500, 5200), // was 23500
  entry("shirts", "laguna-wax", 12000, 4400), // was 16500
  entry("dresses", "medallon-print", 24000, 7600), // was 32500
];

function entry(
  categoryId: string,
  fabricId: string,
  fixedPrice: number,
  customizationExtra: number,
): PriceListEntry {
  return {
    id: `${categoryId}--${fabricId}`,
    categoryId,
    fabricId,
    fixedPrice,
    customizationExtra,
    customizationNote: {
      en: "Made to your measurements, with your choice of neckline, sleeve and length.",
      es: "Hecho a su medida, con el escote, la manga y el largo que usted elija.",
    },
    effectiveDate: "2026-08-31",
  };
}

/**
 * The alterations menu. This is the list that makes Daysi's most profitable
 * service visible: a client can read the price before asking for it.
 */
export const alterationServices: readonly AlterationService[] = [
  {
    id: "hem-dress",
    name: { en: "Hem a dress or skirt", es: "Ruedo de vestido o falda" },
    description: {
      en: "Shortened and finished to match the original hem.",
      es: "Acortado y rematado igual que el ruedo original.",
    },
    fixedPrice: 2800,
    rushSurcharge: 2000,
    turnaround: { en: "3–5 days", es: "3–5 días" },
  },
  {
    id: "hem-pants",
    name: { en: "Hem pants", es: "Ruedo de pantalón" },
    description: {
      en: "Plain hem. Add a cuff or an original hem finish for $8 more.",
      es: "Ruedo sencillo. Con dobladillo o remate original, $8 más.",
    },
    fixedPrice: 2000,
    rushSurcharge: 2000,
    turnaround: { en: "3–5 days", es: "3–5 días" },
  },
  {
    id: "waist",
    name: { en: "Take in or let out the waist", es: "Ajustar o soltar la cintura" },
    description: {
      en: "Up to two inches either way, waistband reset.",
      es: "Hasta dos pulgadas en cualquier dirección, pretina reconstruida.",
    },
    fixedPrice: 3600,
    rushSurcharge: 2000,
    turnaround: { en: "4–6 days", es: "4–6 días" },
  },
  {
    id: "side-seams",
    name: { en: "Take in the bodice or side seams", es: "Ajustar el cuerpo o las costuras" },
    description: {
      en: "Reshaped through the body so the garment sits where it should.",
      es: "Reformado en el cuerpo para que la prenda caiga donde debe.",
    },
    fixedPrice: 4400,
    rushSurcharge: 2000,
    turnaround: { en: "5–7 days", es: "5–7 días" },
  },
  {
    id: "sleeves",
    name: { en: "Shorten sleeves", es: "Acortar mangas" },
    description: {
      en: "Plain sleeves. Cuffed or buttoned sleeves are $16 more.",
      es: "Mangas sencillas. Con puño o botones, $16 más.",
    },
    fixedPrice: 2800,
    rushSurcharge: 2000,
    turnaround: { en: "4–6 days", es: "4–6 días" },
  },
  {
    id: "zipper",
    name: { en: "Replace a zipper", es: "Cambiar un cierre" },
    description: {
      en: "Matched in colour and weight, invisible or exposed.",
      es: "Igualado en color y peso, invisible o expuesto.",
    },
    fixedPrice: 3600,
    rushSurcharge: 2000,
    turnaround: { en: "4–6 days", es: "4–6 días" },
  },
  {
    id: "repair",
    name: { en: "Repair a seam or a tear", es: "Reparar una costura o rotura" },
    description: {
      en: "Mended so the repair does not read as a repair.",
      es: "Reparado para que no se note que fue reparado.",
    },
    fixedPrice: 2000,
    rushSurcharge: 2000,
    turnaround: { en: "3–5 days", es: "3–5 días" },
  },
  {
    id: "resize",
    name: { en: "Resize a whole garment", es: "Cambiar la talla completa" },
    description: {
      en: "Rebuilt through the shoulders, body and length together.",
      es: "Reconstruido en hombros, cuerpo y largo a la vez.",
    },
    fixedPrice: 7600,
    rushSurcharge: 2800,
    turnaround: { en: "1–2 weeks", es: "1–2 semanas" },
  },
  {
    id: "restyle",
    name: { en: "Restyle a garment you own", es: "Rediseñar una prenda suya" },
    description: {
      en: "A new life for a piece you love. Priced from, after we look at it together.",
      es: "Una nueva vida para una prenda que quiere. Precio desde, tras verla juntas.",
    },
    fixedPrice: 12000,
    rushSurcharge: 4000,
    turnaround: { en: "2–3 weeks", es: "2–3 semanas" },
  },
];

/**
 * Bookable sessions. Thirty minutes or a full hour, nothing in between, so the
 * day stays predictable. Time past the booked length is billed in half-hour
 * blocks at the rate below, which the terms state before a client confirms.
 */
export const appointmentTypes: readonly AppointmentType[] = [
  {
    id: "consultation-30",
    minutes: 30,
    name: { en: "30-minute consultation", es: "Consulta de 30 minutos" },
    description: {
      en: "Enough time to look at one garment, take the measurements it needs and agree a price.",
      es: "Tiempo suficiente para ver una prenda, tomar las medidas necesarias y acordar un precio.",
    },
    fee: 8000,
    depositDue: 8000,
    overtimeRatePerHalfHour: 4000,
    suitedFor: [
      { en: "An alteration on a garment you already own", es: "Un arreglo de una prenda que ya tiene" },
      { en: "A fitting for a piece already in progress", es: "Una prueba de una pieza en proceso" },
      { en: "Choosing a size from the collection", es: "Escoger una talla de la colección" },
    ],
  },
  {
    id: "consultation-60",
    minutes: 60,
    name: { en: "One-hour design session", es: "Sesión de diseño de una hora" },
    description: {
      en: "A full sitting: your idea, fabric in hand, a sketch, full measurements and a written estimate.",
      es: "Una sesión completa: su idea, tela en mano, un boceto, medidas completas y un estimado por escrito.",
    },
    fee: 14000,
    depositDue: 14000,
    overtimeRatePerHalfHour: 4000,
    suitedFor: [
      { en: "A custom piece made from scratch", es: "Una pieza a medida desde cero" },
      { en: "Wedding, quinceañera and occasion wear", es: "Boda, quinceañera y ropa de ocasión" },
      { en: "Restyling several garments at once", es: "Rediseñar varias prendas a la vez" },
    ],
  },
];

/** The consultation fee comes off the order if it is placed within this window. */
export const consultationCreditDays = 30;

/** Share of a custom commission due before work begins. */
export const commissionDepositRate = 0.5;
