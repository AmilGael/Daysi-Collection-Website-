import type { GarmentStyle } from "./types";

/**
 * ERD: GARMENT_STYLE, with its STYLE_PHOTO and STYLE_SIZE rows inlined.
 *
 * A style carries no price of its own — it points at a price list entry, so the
 * gallery, the detail page and the estimate builder all read the same number.
 *
 * Photography: every style below is one of Daysi's own garments, photographed
 * for the site and stored under /images/real. The generated stand-ins that
 * once filled this catalog are gone. See README, "Placeholder content".
 */
export const styles: readonly GarmentStyle[] = [
  {
    id: "frutera",
    slug: "frutera",
    name: { en: "Frutera two-piece", es: "Conjunto Frutera" },
    categoryId: "heritage",
    priceEntryId: "heritage--frutera-print",
    color: {
      en: "Emerald over a painted market scene",
      es: "Esmeralda sobre una escena de mercado pintada",
    },
    description: {
      en: "An emerald bow blouse over a skirt of market women carrying fruit. The piece Daysi shows first.",
      es: "Blusa esmeralda con lazo sobre una falda de fruteras con canastas. La pieza que Daysi enseña primero.",
    },
    detail: {
      en: "The blouse ties high or hangs open; the skirt is cut so the line of women runs unbroken around the hem. Sold as a set.",
      es: "La blusa se anuda alta o cae abierta; la falda va cortada para que la fila de fruteras corra sin cortes por el ruedo. Se vende como conjunto.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/real/frutera-capri.jpg",
        alt: {
          en: "The Frutera two-piece worn on a terrace at golden hour.",
          es: "El conjunto Frutera llevado en una terraza al atardecer.",
        },
        isPrimary: true,
      },
      {
        src: "/images/gallery/35e49b87.jpg",
        alt: {
          en: "A client wearing the Frutera skirt with a white bodice.",
          es: "Una clienta con la falda Frutera y un cuerpo blanco.",
        },
        isPrimary: false,
      },
      {
        src: "/images/gallery/b1621c2a.jpg",
        alt: {
          en: "The Frutera skirt worn at home, photographed by its owner.",
          es: "La falda Frutera en casa, fotografiada por su dueña.",
        },
        isPrimary: false,
      },
      {
        src: "/images/real/frutera-set.jpg",
        alt: {
          en: "The Frutera two-piece: an emerald bow blouse over the market-scene skirt, photographed in the atelier.",
          es: "El conjunto Frutera: blusa esmeralda con lazo sobre la falda de fruteras, fotografiado en el taller.",
        },
        isPrimary: false,
      },
      {
        src: "/images/real/frutera-set-full.jpg",
        alt: {
          en: "Full-length view of the Frutera two-piece.",
          es: "Vista completa del conjunto Frutera.",
        },
        isPrimary: false,
      },
      {
        src: "/images/real/frutera-campaign.jpg",
        alt: {
          en: "Four Frutera skirts styled with green, blue and marigold tops.",
          es: "Cuatro faldas Frutera con blusas verde, azul y amarilla.",
        },
        isPrimary: false,
      },
      {
        src: "/images/real/frutera-courtyard.jpg",
        alt: {
          en: "The Frutera skirt worn with a knotted marigold top in a courtyard.",
          es: "La falda Frutera con una blusa amarilla anudada, en un patio.",
        },
        isPrimary: false,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "sirena",
    slug: "sirena",
    name: { en: "Sirena shirt dress", es: "Vestido camisero Sirena" },
    categoryId: "heritage",
    priceEntryId: "heritage--fish-batik",
    color: {
      en: "Black and white with red fish",
      es: "Negro y blanco con peces rojos",
    },
    description: {
      en: "A standing collar and a low, swinging tier in hand-waxed fish batik. Made in a run of twelve.",
      es: "Cuello alto y un volante bajo que gira, en batik de peces encerado a mano. Hecho en una serie de doce.",
    },
    detail: {
      en: "Buttons run from collar to hem, and the print is placed so a fish lands on the chest of every piece. No two are cut alike.",
      es: "Los botones corren del cuello al ruedo, y el estampado va colocado para que un pez caiga en el pecho de cada pieza. No hay dos iguales.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/real/fish-batik-dress.jpg",
        alt: {
          en: "The Sirena shirt dress in black fish batik with red fish, worn front-on.",
          es: "El vestido camisero Sirena en batik negro con peces rojos, visto de frente.",
        },
        isPrimary: true,
      },
      {
        src: "/images/real/fish-batik-dress-model.jpg",
        alt: {
          en: "The Sirena shirt dress worn with arms crossed.",
          es: "El vestido camisero Sirena llevado con los brazos cruzados.",
        },
        isPrimary: false,
      },
      {
        src: "/images/real/sirena-model-front.jpg",
        alt: {
          en: "Full-length front view of the Sirena shirt dress.",
          es: "Vista frontal completa del vestido camisero Sirena.",
        },
        isPrimary: false,
      },
      {
        src: "/images/real/sirena-subway.jpg",
        alt: {
          en: "The Sirena shirt dress worn seated on a subway platform bench.",
          es: "El vestido Sirena llevado en una banca del metro.",
        },
        isPrimary: false,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
    premiereId: "otono-2026",
  },
  {
    id: "ocelote",
    slug: "ocelote",
    name: { en: "Ocelote lounge set", es: "Conjunto Ocelote" },
    categoryId: "pants",
    priceEntryId: "pants--ocelote-print",
    color: { en: "Ivory, coral and black", es: "Marfil, coral y negro" },
    description: {
      en: "A camp shirt and a wide cropped pant in the same painted leopard bloom. Worn together or apart.",
      es: "Camisa campera y pantalón ancho corto en la misma flor de leopardo pintada. Se llevan juntos o por separado.",
    },
    detail: {
      en: "The shirt wears open over the pant, and the elastic sits only at the back of the waist. A full bloom is placed on each leg.",
      es: "La camisa se lleva abierta sobre el pantalón, y el elástico va solo en la parte de atrás de la cintura. Una flor completa cae en cada pierna.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/real/ocelote-set.jpg",
        alt: {
          en: "The Ocelote lounge set laid flat: camp shirt and wide cropped pant in a coral and black bloom on ivory.",
          es: "El conjunto Ocelote extendido: camisa campera y pantalón ancho corto en flor coral y negra sobre marfil.",
        },
        isPrimary: true,
      },
      {
        src: "/images/real/ocelote-blouse.jpg",
        alt: {
          en: "The Ocelote camp shirt buttoned, front view.",
          es: "La camisa campera Ocelote abotonada, vista de frente.",
        },
        isPrimary: false,
      },
      {
        src: "/images/real/ocelote-blouse-back.jpg",
        alt: {
          en: "Back view of the Ocelote camp shirt.",
          es: "Vista trasera de la camisa campera Ocelote.",
        },
        isPrimary: false,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "medallon",
    slug: "medallon",
    name: { en: "Medallón two-piece", es: "Conjunto Medallón" },
    categoryId: "dresses",
    priceEntryId: "dresses--medallon-print",
    color: { en: "Black and gold", es: "Negro y dorado" },
    description: {
      en: "A twisted bandeau and a full midi skirt in golden medallions, hemmed by hand in white ric-rac.",
      es: "Bandeau torcido y falda midi amplia en medallones dorados, con ruedo de trensilla blanca cosido a mano.",
    },
    detail: {
      en: "The skirt sits at the natural waist and turns when you do. The same ric-rac from the hem ties the waist. Worn as a set or apart.",
      es: "La falda asienta en la cintura natural y gira cuando usted gira. La misma trensilla del ruedo amarra la cintura. Se lleva como conjunto o por separado.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/real/medallon-set.jpg",
        alt: {
          en: "The Medallón two-piece: bandeau and full midi skirt in black with golden medallions.",
          es: "El conjunto Medallón: bandeau y falda midi amplia en negro con medallones dorados.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "laguna",
    slug: "laguna",
    name: { en: "Laguna camp shirt", es: "Camisa campera Laguna" },
    categoryId: "shirts",
    priceEntryId: "shirts--laguna-wax",
    color: { en: "Steel blue, marigold and turquoise", es: "Azul acero, amarillo y turquesa" },
    description: {
      en: "The Yurumein cut in its second colourway: a cooler wax print for the same easy collar.",
      es: "El corte Yurumein en su segundo color: un wax más fresco para el mismo cuello relajado.",
    },
    detail: {
      en: "Chest pocket matched to the print, back cut in one piece so the fans run unbroken. Wears open or buttoned.",
      es: "Bolsillo de pecho igualado al estampado, espalda de una pieza para que los abanicos corran sin cortes. Se lleva abierta o abotonada.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/real/laguna-shirt.jpg",
        alt: {
          en: "The Laguna camp shirt in steel-blue wax print, front view.",
          es: "La camisa campera Laguna en wax azul acero, vista de frente.",
        },
        isPrimary: true,
      },
      {
        src: "/images/real/laguna-shirt-back.jpg",
        alt: {
          en: "Back view of the Laguna camp shirt.",
          es: "Vista trasera de la camisa campera Laguna.",
        },
        isPrimary: false,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "yurumein",
    slug: "yurumein",
    name: { en: "Yurumein camp shirt", es: "Camisa campera Yurumein" },
    categoryId: "shirts",
    priceEntryId: "shirts--wax-print",
    color: { en: "Teal, marigold and turquoise", es: "Verde azulado, amarillo y turquesa" },
    description: {
      en: "A relaxed camp collar in West African wax print. Named for Yurumein, the Garífuna name for the island the people came from.",
      es: "Cuello campero relajado en estampado wax de África Occidental. Nombrada por Yurumein, el nombre garífuna de la isla de donde vino el pueblo.",
    },
    detail: {
      en: "Cut in one piece across the back so the pattern runs unbroken. Chest pocket matched to the print. Wears open or buttoned.",
      es: "Cortada de una pieza en la espalda para que el patrón corra sin cortes. Bolsillo de pecho igualado al estampado. Se lleva abierta o abotonada.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/real/wax-print-shirt.jpg",
        alt: {
          en: "The Yurumein camp shirt in teal and marigold wax print cotton, photographed in the atelier.",
          es: "La camisa campera Yurumein en algodón wax verde azulado y amarillo, fotografiada en el taller.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "guanaba",
    slug: "guanaba",
    name: { en: "Guanaba camp shirt", es: "Camisa campera Guanaba" },
    categoryId: "shirts",
    priceEntryId: "shirts--tropical-leaf",
    color: { en: "Black with cream and marigold", es: "Negro con crema y amarillo" },
    description: {
      en: "The house print: banana and monstera leaves drawn by hand, printed on black.",
      es: "El estampado de la casa: hojas de guineo y costilla de Adán dibujadas a mano, impresas sobre negro.",
    },
    detail: {
      en: "An easy shoulder and a straight hem, made to be worn out. Buttons cut from black corozo.",
      es: "Hombro cómodo y ruedo recto, hecha para llevar por fuera. Botones de corozo negro.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/real/tropical-leaf-shirt.jpg",
        alt: {
          en: "The Guanaba camp shirt in a black, cream and marigold tropical leaf print, on its hanger in the atelier.",
          es: "La camisa campera Guanaba en estampado de hoja tropical negro, crema y amarillo, en su gancho en el taller.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "amapola",
    slug: "amapola",
    name: { en: "Amapola camp shirt", es: "Camisa campera Amapola" },
    categoryId: "shirts",
    priceEntryId: "shirts--daisy-cotton",
    color: { en: "Cream with orange and sky", es: "Crema con naranja y celeste" },
    description: {
      en: "One large flower placed by hand on each front, so no two shirts are cut alike.",
      es: "Una flor grande colocada a mano en cada delantero, así no hay dos camisas iguales.",
    },
    detail: {
      en: "Lighter cotton for summer, with a short sleeve and a soft collar that sits flat without pressing.",
      es: "Algodón más ligero para el verano, manga corta y cuello suave que se asienta sin plancharse.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: false },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/real/orange-bloom-shirt.jpg",
        alt: {
          en: "The Amapola camp shirt in cream cotton with a large orange flower, freshly made in the atelier.",
          es: "La camisa campera Amapola en algodón crema con una flor naranja grande, recién hecha en el taller.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
];
