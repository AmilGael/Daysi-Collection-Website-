import type { Premiere, Service } from "./types";

/**
 * Limited-edition premieres. Five or six pieces every three months, shown
 * before they are made — the way a house previews a season months ahead of
 * delivery. Clients sign up to see the reveal first and to claim a number in
 * the edition before it opens to everyone.
 */
export const premieres: readonly Premiere[] = [
  {
    id: "otono-2026",
    slug: "otono-2026",
    season: { en: "Autumn 2026", es: "Otoño 2026" },
    title: { en: "Yurumein", es: "Yurumein" },
    story: {
      en: "Six pieces built around the journey the Garífuna made from Yurumein to the coast. Heavy linens, black grounds, and one colour of yellow that runs through every piece.",
      es: "Seis piezas construidas alrededor del viaje que hicieron los garífunas desde Yurumein hasta la costa. Linos con cuerpo, fondos negros, y un solo amarillo que atraviesa cada pieza.",
    },
    inspiration: {
      en: "Drawn from wrap dress and head wrap traditions, cut for a Bronx winter rather than a stage.",
      es: "Inspirado en las tradiciones del vestido cruzado y el turbante, cortado para un invierno del Bronx y no para un escenario.",
    },
    revealDate: "2026-09-15",
    releaseDate: "2026-10-06",
    piecesPlanned: 6,
    editionSize: 12,
    coverImage: "/images/premieres/otono-2026.jpg",
    styleIds: ["wanaragua"],
  },
  {
    id: "verano-2026",
    slug: "verano-2026",
    season: { en: "Summer 2026", es: "Verano 2026" },
    title: { en: "Linen and Sun", es: "Lino y Sol" },
    story: {
      en: "The collection that started the fixed price list: five linen pieces, one print, and sizes cut for the women who actually walk into the atelier.",
      es: "La colección que dio origen a la lista de precios fijos: cinco piezas de lino, un estampado, y tallas cortadas para las mujeres que de verdad entran al taller.",
    },
    inspiration: {
      en: "A summer of floral linen, shown on the block before it was shown anywhere else.",
      es: "Un verano de lino floral, mostrado en el barrio antes que en ningún otro sitio.",
    },
    revealDate: "2026-05-12",
    releaseDate: "2026-06-02",
    piecesPlanned: 5,
    editionSize: 15,
    coverImage: "/images/styles/puff-sleeve-dress.jpg",
    styleIds: ["flor-de-sol", "serena", "malecon", "domingo", "amapola"],
  },
];

/** The three services, in the order the PRD lists them. */
export const services: readonly Service[] = [
  {
    id: "custom",
    slug: "custom",
    name: { en: "Custom garments", es: "Prendas a medida" },
    promise: {
      en: "Made to your measurements, not to a size chart.",
      es: "Hecho a sus medidas, no a una tabla de tallas.",
    },
    description: {
      en: "You bring an idea, a photo or a piece you already love. We sit down together, take your measurements properly, choose the cloth, and agree on a written price before anything is cut.",
      es: "Usted trae una idea, una foto o una prenda que ya quiere. Nos sentamos juntas, tomamos sus medidas como se debe, escogemos la tela y acordamos un precio por escrito antes de cortar nada.",
    },
    includes: [
      { en: "A one-hour design session with a sketch", es: "Una sesión de diseño de una hora con boceto" },
      { en: "Full measurements taken in person", es: "Medidas completas tomadas en persona" },
      { en: "A written estimate before work begins", es: "Un estimado por escrito antes de empezar" },
      { en: "Two fittings included", es: "Dos pruebas incluidas" },
    ],
    image: "/images/atelier/fitting.jpg",
  },
  {
    id: "alterations",
    slug: "alterations",
    name: { en: "Alterations", es: "Arreglos" },
    promise: {
      en: "The clothes you already own, finally fitting you.",
      es: "La ropa que ya tiene, por fin a su medida.",
    },
    description: {
      en: "Hems, waists, sleeves, zippers and full resizes, at prices published in advance so you know what you are paying before you hand anything over. Most work is back with you inside a week.",
      es: "Ruedos, cinturas, mangas, cierres y cambios de talla completos, con precios publicados de antemano para que sepa lo que va a pagar antes de entregar nada. Casi todo vuelve a sus manos en menos de una semana.",
    },
    includes: [
      { en: "A published price for every common alteration", es: "Un precio publicado para cada arreglo común" },
      { en: "Rush service available for an extra fee", es: "Servicio urgente disponible por un cargo extra" },
      { en: "Work guaranteed for thirty days", es: "Trabajo garantizado por treinta días" },
      { en: "Request it online, no phone call needed", es: "Solicítelo en línea, sin necesidad de llamar" },
    ],
    image: "/images/atelier/hemming.jpg",
  },
  {
    id: "ready-made",
    slug: "ready-made",
    name: { en: "Ready-made styles", es: "Piezas listas" },
    promise: {
      en: "Small runs, fixed prices, sizes S to L.",
      es: "Series cortas, precios fijos, tallas de S a L.",
    },
    description: {
      en: "A small collection cut in advance and priced clearly. Every piece can be customised — a different neckline, sleeve or length — for a set extra charge rather than a negotiation.",
      es: "Una colección pequeña cortada de antemano y con precio claro. Cada pieza se puede personalizar — otro escote, otra manga, otro largo — por un cargo extra fijo y no por negociación.",
    },
    includes: [
      { en: "Filter by design and by size", es: "Filtre por diseño y por talla" },
      { en: "The price you see is the price you pay", es: "El precio que ve es el precio que paga" },
      { en: "Customisation at a set extra charge", es: "Personalización con un cargo extra fijo" },
      { en: "Hemmed to your height at no cost", es: "Ruedo a su altura sin costo" },
    ],
    image: "/images/atelier/rack.jpg",
  },
];
