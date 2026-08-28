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
 */
export const priceList: readonly PriceListEntry[] = [
  entry("dresses", "floral-linen", 32500, 9500),
  entry("dresses", "marigold-linen", 29500, 9500),
  entry("dresses", "natural-linen", 28500, 9500),
  entry("dresses", "black-linen", 29500, 9500),
  entry("dresses", "daisy-cotton", 26500, 9500),
  entry("pants", "floral-linen", 21500, 6500),
  entry("pants", "natural-linen", 18500, 6500),
  entry("pants", "black-linen", 19500, 6500),
  entry("shirts", "wax-print", 16500, 5500),
  entry("shirts", "tropical-leaf", 17500, 5500),
  entry("shirts", "daisy-cotton", 14500, 5500),
  entry("heritage", "wax-print", 39500, 12000),
  entry("heritage", "tropical-leaf", 37500, 12000),
  entry("heritage", "fish-batik", 39500, 12000),
  entry("heritage", "frutera-print", 42500, 12000),
  entry("pants", "ocelote-print", 23500, 6500),
  entry("shirts", "laguna-wax", 16500, 5500),
  entry("dresses", "medallon-print", 32500, 9500),
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
    effectiveDate: "2026-08-01",
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
    fixedPrice: 3500,
    rushSurcharge: 2500,
    turnaround: { en: "3–5 days", es: "3–5 días" },
  },
  {
    id: "hem-pants",
    name: { en: "Hem pants", es: "Ruedo de pantalón" },
    description: {
      en: "Plain hem. Add a cuff or an original hem finish for $10 more.",
      es: "Ruedo sencillo. Con dobladillo o remate original, $10 más.",
    },
    fixedPrice: 2500,
    rushSurcharge: 2500,
    turnaround: { en: "3–5 days", es: "3–5 días" },
  },
  {
    id: "waist",
    name: { en: "Take in or let out the waist", es: "Ajustar o soltar la cintura" },
    description: {
      en: "Up to two inches either way, waistband reset.",
      es: "Hasta dos pulgadas en cualquier dirección, pretina reconstruida.",
    },
    fixedPrice: 4500,
    rushSurcharge: 2500,
    turnaround: { en: "4–6 days", es: "4–6 días" },
  },
  {
    id: "side-seams",
    name: { en: "Take in the bodice or side seams", es: "Ajustar el cuerpo o las costuras" },
    description: {
      en: "Reshaped through the body so the garment sits where it should.",
      es: "Reformado en el cuerpo para que la prenda caiga donde debe.",
    },
    fixedPrice: 5500,
    rushSurcharge: 2500,
    turnaround: { en: "5–7 days", es: "5–7 días" },
  },
  {
    id: "sleeves",
    name: { en: "Shorten sleeves", es: "Acortar mangas" },
    description: {
      en: "Plain sleeves. Cuffed or buttoned sleeves are $20 more.",
      es: "Mangas sencillas. Con puño o botones, $20 más.",
    },
    fixedPrice: 3500,
    rushSurcharge: 2500,
    turnaround: { en: "4–6 days", es: "4–6 días" },
  },
  {
    id: "zipper",
    name: { en: "Replace a zipper", es: "Cambiar un cierre" },
    description: {
      en: "Matched in colour and weight, invisible or exposed.",
      es: "Igualado en color y peso, invisible o expuesto.",
    },
    fixedPrice: 4500,
    rushSurcharge: 2500,
    turnaround: { en: "4–6 days", es: "4–6 días" },
  },
  {
    id: "repair",
    name: { en: "Repair a seam or a tear", es: "Reparar una costura o rotura" },
    description: {
      en: "Mended so the repair does not read as a repair.",
      es: "Reparado para que no se note que fue reparado.",
    },
    fixedPrice: 2500,
    rushSurcharge: 2500,
    turnaround: { en: "3–5 days", es: "3–5 días" },
  },
  {
    id: "resize",
    name: { en: "Resize a whole garment", es: "Cambiar la talla completa" },
    description: {
      en: "Rebuilt through the shoulders, body and length together.",
      es: "Reconstruido en hombros, cuerpo y largo a la vez.",
    },
    fixedPrice: 9500,
    rushSurcharge: 3500,
    turnaround: { en: "1–2 weeks", es: "1–2 semanas" },
  },
  {
    id: "restyle",
    name: { en: "Restyle a garment you own", es: "Rediseñar una prenda suya" },
    description: {
      en: "A new life for a piece you love. Priced from, after we look at it together.",
      es: "Una nueva vida para una prenda que quiere. Precio desde, tras verla juntas.",
    },
    fixedPrice: 15000,
    rushSurcharge: 5000,
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
    fee: 10000,
    depositDue: 10000,
    overtimeRatePerHalfHour: 5000,
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
    fee: 17500,
    depositDue: 17500,
    overtimeRatePerHalfHour: 5000,
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
