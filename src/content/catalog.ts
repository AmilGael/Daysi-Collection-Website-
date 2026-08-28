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
      en: "Wide legs, high waists and cloth that holds its shape all day.",
      es: "Piernas anchas, cinturas altas y telas que aguantan la forma todo el día.",
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
      en: "Pieces drawn from Garífuna dress, made with intention.",
      es: "Piezas inspiradas en la vestimenta garífuna, hechas con intención.",
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
    id: "wax-print",
    name: { en: "Wax print cotton", es: "Algodón wax" },
    description: {
      en: "West African wax print, teal ground with marigold geometry.",
      es: "Estampado wax de África Occidental, fondo verde azulado con geometría amarilla.",
    },
    swatchImage: "/images/real/fabric-wax-print.jpg",
    averageColor: "#25545C",
  },
  {
    id: "tropical-leaf",
    name: { en: "Tropical leaf cotton", es: "Algodón hoja tropical" },
    description: {
      en: "Black ground with cream and marigold leaves, a Caribbean reference.",
      es: "Fondo negro con hojas crema y amarillas, una referencia caribeña.",
    },
    swatchImage: "/images/real/fabric-tropical-leaf.jpg",
    averageColor: "#2A2A22",
  },
  {
    id: "daisy-cotton",
    name: { en: "Daisy cotton", es: "Algodón margarita" },
    description: {
      en: "White cotton with one large orange bloom placed by hand.",
      es: "Algodón blanco con una flor naranja grande colocada a mano.",
    },
    swatchImage: "/images/real/fabric-daisy-cotton.jpg",
    averageColor: "#EFEAE0",
  },
  {
    id: "fish-batik",
    name: { en: "Fish batik cotton", es: "Algodón batik de peces" },
    description: {
      en: "Hand-waxed batik: red fish and white blossoms over dotted spirals on black.",
      es: "Batik encerado a mano: peces rojos y flores blancas sobre espirales punteadas en negro.",
    },
    swatchImage: "/images/real/fabric-fish-batik.jpg",
    averageColor: "#1B1917",
  },
  {
    id: "frutera-print",
    name: { en: "Frutera print silk", es: "Seda de fruteras" },
    description: {
      en: "Market women with fruit baskets, painted the way the Caribbean paints them.",
      es: "Fruteras con sus canastas, pintadas como las pinta el Caribe.",
    },
    swatchImage: "/images/real/fabric-frutera.jpg",
    averageColor: "#E8E4DA",
  },
  {
    id: "ocelote-print",
    name: { en: "Ocelote charmeuse", es: "Charmeuse ocelote" },
    description: {
      en: "A brushed leopard bloom in coral, pink and black on ivory.",
      es: "Flor de leopardo pintada en coral, rosa y negro sobre marfil.",
    },
    swatchImage: "/images/real/fabric-ocelote.jpg",
    averageColor: "#E7DED2",
  },
  {
    id: "laguna-wax",
    name: { en: "Laguna wax cotton", es: "Algodón wax laguna" },
    description: {
      en: "Wax print on a steel-blue ground: marigold diamonds inside turquoise fans.",
      es: "Estampado wax sobre fondo azul acero: rombos amarillos dentro de abanicos turquesa.",
    },
    swatchImage: "/images/real/fabric-laguna.jpg",
    averageColor: "#4A5A5E",
  },
  {
    id: "medallon-print",
    name: { en: "Medallón cotton", es: "Algodón medallón" },
    description: {
      en: "Black cotton struck with golden medallions, finished in white ric-rac.",
      es: "Algodón negro sembrado de medallones dorados, rematado en trensilla blanca.",
    },
    swatchImage: "/images/real/fabric-medallon.jpg",
    averageColor: "#2A2415",
  },
];
