import type { DesignCategory, Fabric, Size } from "./types";

/** ERD: DESIGN_CATEGORY. The "filter by design" axis of the gallery. */
export const categories: readonly DesignCategory[] = [
  {
    id: "dresses",
    slug: "dresses",
    name: { en: "Dresses", es: "Vestidos" },
    blurb: {
      en: "Day dresses and occasion pieces cut for movement and for a real body.",
      es: "Vestidos de diario y de ocasión, cortados para el movimiento y para un cuerpo real.",
    },
  },
  {
    id: "pants",
    slug: "pants",
    name: { en: "Pants", es: "Pantalones" },
    blurb: {
      en: "Wide legs, high waists and soft linens that hold their shape all day.",
      es: "Piernas anchas, cinturas altas y linos suaves que aguantan todo el día.",
    },
  },
  {
    id: "shirts",
    slug: "shirts",
    name: { en: "Shirts", es: "Camisas" },
    blurb: {
      en: "Camp collars in bold prints, made to be worn open, tucked or tied.",
      es: "Cuellos camperos en estampados fuertes, para llevar abiertos, por dentro o anudados.",
    },
  },
  {
    id: "heritage",
    slug: "heritage",
    name: { en: "Heritage", es: "Herencia" },
    blurb: {
      en: "Pieces drawn from Afro-Latin and Garífuna dress, made with intention.",
      es: "Piezas inspiradas en la vestimenta afrolatina y garífuna, hechas con intención.",
    },
  },
];

/** ERD: SIZE. */
export const sizes: readonly Size[] = [
  {
    id: "s",
    label: "S",
    measurements: { en: "Bust 34–36in · Waist 27–29in", es: "Busto 86–91cm · Cintura 69–74cm" },
    sortOrder: 1,
  },
  {
    id: "m",
    label: "M",
    measurements: { en: "Bust 37–39in · Waist 30–32in", es: "Busto 94–99cm · Cintura 76–81cm" },
    sortOrder: 2,
  },
  {
    id: "l",
    label: "L",
    measurements: { en: "Bust 40–43in · Waist 33–36in", es: "Busto 102–109cm · Cintura 84–91cm" },
    sortOrder: 3,
  },
];

/**
 * ERD: FABRIC. Each one carries the swatch image the design studio composites
 * onto a silhouette, so the fabric list and the visualiser can never drift.
 */
export const fabrics: readonly Fabric[] = [
  {
    id: "floral-linen",
    name: { en: "Floral linen", es: "Lino floral" },
    description: {
      en: "Mid-weight linen, hand-picked print in marigold and black.",
      es: "Lino de peso medio, estampado escogido a mano en amarillo y negro.",
    },
    swatchImage: "/images/fabrics/floral-linen.jpg",
    averageColor: "#C8A23A",
  },
  {
    id: "marigold-linen",
    name: { en: "Marigold linen", es: "Lino amarillo" },
    description: {
      en: "The house yellow, in a linen heavy enough to hold a pleat.",
      es: "El amarillo de la casa, en un lino con cuerpo para sostener un pliegue.",
    },
    swatchImage: "/images/fabrics/marigold-linen.jpg",
    averageColor: "#D5A312",
  },
  {
    id: "natural-linen",
    name: { en: "Natural linen", es: "Lino natural" },
    description: {
      en: "Undyed linen that softens with every wash.",
      es: "Lino sin teñir que se suaviza con cada lavado.",
    },
    swatchImage: "/images/fabrics/natural-linen.jpg",
    averageColor: "#D9CFBC",
  },
  {
    id: "black-linen",
    name: { en: "Black linen", es: "Lino negro" },
    description: {
      en: "Deep black linen with a faint sheen in the weave.",
      es: "Lino negro profundo con un brillo tenue en el tejido.",
    },
    swatchImage: "/images/fabrics/black-linen.jpg",
    averageColor: "#221F1C",
  },
  {
    id: "wax-print",
    name: { en: "Wax print cotton", es: "Algodón wax" },
    description: {
      en: "West African wax print, teal ground with marigold geometry.",
      es: "Estampado wax de África Occidental, fondo verde azulado con geometría amarilla.",
    },
    swatchImage: "/images/fabrics/wax-print.jpg",
    averageColor: "#25545C",
  },
  {
    id: "tropical-leaf",
    name: { en: "Tropical leaf cotton", es: "Algodón hoja tropical" },
    description: {
      en: "Black ground with cream and marigold leaves, a Caribbean reference.",
      es: "Fondo negro con hojas crema y amarillas, una referencia caribeña.",
    },
    swatchImage: "/images/fabrics/tropical-leaf.jpg",
    averageColor: "#2A2A22",
  },
  {
    id: "daisy-cotton",
    name: { en: "Daisy cotton", es: "Algodón margarita" },
    description: {
      en: "White poplin scattered with the daisy from the Daysi Collection mark.",
      es: "Popelina blanca sembrada con la margarita del sello Daysi Collection.",
    },
    swatchImage: "/images/fabrics/daisy-cotton.jpg",
    averageColor: "#EFEAE0",
  },
];
