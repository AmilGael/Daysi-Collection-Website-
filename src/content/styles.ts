import type { GarmentStyle } from "./types";

/**
 * ERD: GARMENT_STYLE, with its STYLE_PHOTO and STYLE_SIZE rows inlined.
 *
 * A style carries no price of its own — it points at a price list entry, so the
 * gallery, the detail page and the estimate builder all read the same number.
 *
 * The photography here was generated to stand in for Daysi's own garments while
 * her shoot is being produced. See README, "Placeholder content".
 */
export const styles: readonly GarmentStyle[] = [
  {
    id: "flor-de-sol",
    slug: "flor-de-sol",
    name: { en: "Flor de Sol dress", es: "Vestido Flor de Sol" },
    categoryId: "dresses",
    priceEntryId: "dresses--floral-linen",
    color: { en: "Marigold and black on cream", es: "Amarillo y negro sobre crema" },
    description: {
      en: "A fitted waist under a full skirt, with puff sleeves that hold their shape without a lining.",
      es: "Cintura entallada bajo una falda amplia, con mangas abullonadas que mantienen su forma sin forro.",
    },
    detail: {
      en: "Cut on the straight grain so the print reads clean across the front. Side pockets set into the seam. Back zip, no waist elastic.",
      es: "Cortado a hilo para que el estampado se lea limpio al frente. Bolsillos en la costura lateral. Cierre atrás, sin elástico en la cintura.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/styles/puff-sleeve-dress.jpg",
        alt: {
          en: "Full-length view of the Flor de Sol dress in marigold and black floral linen.",
          es: "Vista completa del vestido Flor de Sol en lino floral amarillo y negro.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "serena",
    slug: "serena",
    name: { en: "Serena midi dress", es: "Vestido midi Serena" },
    categoryId: "dresses",
    priceEntryId: "dresses--natural-linen",
    color: { en: "Cream with a black print", es: "Crema con estampado negro" },
    description: {
      en: "A square neckline and a straight midi line. The quiet one in the collection.",
      es: "Escote cuadrado y línea midi recta. La pieza tranquila de la colección.",
    },
    detail: {
      en: "Sleeveless, with a facing at the neck and arm so nothing shows from the outside. Falls just below the knee.",
      es: "Sin mangas, con vista en el escote y la sisa para que nada se vea por fuera. Cae justo bajo la rodilla.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: false },
    ],
    photos: [
      {
        src: "/images/styles/square-neck-midi.jpg",
        alt: {
          en: "Full-length view of the Serena sleeveless midi dress in cream linen.",
          es: "Vista completa del vestido midi Serena sin mangas en lino crema.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "marisol",
    slug: "marisol",
    name: { en: "Marisol shirt dress", es: "Vestido camisero Marisol" },
    categoryId: "dresses",
    priceEntryId: "dresses--marigold-linen",
    color: { en: "Marigold", es: "Amarillo" },
    description: {
      en: "Front buttons all the way down and a belt in the same cloth, so you set the waist yourself.",
      es: "Botones al frente de arriba abajo y un cinturón de la misma tela, para que usted marque la cintura.",
    },
    detail: {
      en: "A collar with a stand, a flared skirt and a belt loop hidden in the side seam. Wears open over trousers just as well.",
      es: "Cuello con pie, falda acampanada y presilla escondida en la costura lateral. Se lleva abierto sobre pantalón igual de bien.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/styles/belted-shirt-dress.jpg",
        alt: {
          en: "Full-length view of the Marisol belted shirt dress in marigold linen.",
          es: "Vista completa del vestido camisero Marisol con cinturón en lino amarillo.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "malecon",
    slug: "malecon",
    name: { en: "Malecón palazzo pants", es: "Pantalón palazzo Malecón" },
    categoryId: "pants",
    priceEntryId: "pants--floral-linen",
    color: { en: "Marigold and black on cream", es: "Amarillo y negro sobre crema" },
    description: {
      en: "A high waist and a wide leg that moves like a skirt when you walk.",
      es: "Cintura alta y pierna ancha que se mueve como una falda al caminar.",
    },
    detail: {
      en: "Flat front, elastic only at the back of the waistband, deep pockets. Hemmed to your height at no extra cost.",
      es: "Frente plano, elástico solo en la parte de atrás de la pretina, bolsillos profundos. Ruedo a su altura sin costo extra.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/styles/palazzo-pants.jpg",
        alt: {
          en: "Full-length view of the Malecón wide-leg palazzo pants in floral linen.",
          es: "Vista completa del pantalón palazzo Malecón de pierna ancha en lino floral.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "concordia",
    slug: "concordia",
    name: { en: "Concordia culottes", es: "Culotte Concordia" },
    categoryId: "pants",
    priceEntryId: "pants--black-linen",
    color: { en: "Black", es: "Negro" },
    description: {
      en: "Mid-calf and full through the leg. The pair that works for the office and for dinner after.",
      es: "A media pantorrilla y amplio de pierna. El par que sirve para la oficina y para la cena después.",
    },
    detail: {
      en: "Two pressed pleats at the front, side zip, no back pockets so the line stays clean.",
      es: "Dos pliegues planchados al frente, cierre lateral, sin bolsillos traseros para que la línea quede limpia.",
    },
    sizes: [
      { sizeId: "s", inStock: false },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/styles/culottes.jpg",
        alt: {
          en: "Full-length view of the Concordia mid-calf culottes in black linen.",
          es: "Vista completa del culotte Concordia a media pantorrilla en lino negro.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "domingo",
    slug: "domingo",
    name: { en: "Domingo linen joggers", es: "Jogger de lino Domingo" },
    categoryId: "pants",
    priceEntryId: "pants--natural-linen",
    color: { en: "Natural", es: "Natural" },
    description: {
      en: "A cuffed ankle and a soft waist, cut in linen so it never reads as sportswear.",
      es: "Tobillo con puño y cintura suave, cortado en lino para que nunca parezca ropa deportiva.",
    },
    detail: {
      en: "Drawcord in a matching linen tape, ribbed cuff faced in the same cloth, patch pockets.",
      es: "Cordón en cinta de lino a juego, puño forrado en la misma tela, bolsillos de parche.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/styles/linen-joggers.jpg",
        alt: {
          en: "Full-length view of the Domingo cuffed linen joggers in natural linen.",
          es: "Vista completa del jogger Domingo con puño en lino natural.",
        },
        isPrimary: true,
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
        src: "/images/styles/wax-print-shirt.jpg",
        alt: {
          en: "The Yurumein camp shirt in teal and marigold wax print cotton.",
          es: "La camisa campera Yurumein en algodón wax verde azulado y amarillo.",
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
        src: "/images/styles/tropical-leaf-shirt.jpg",
        alt: {
          en: "The Guanaba camp shirt in a black, cream and marigold tropical leaf print.",
          es: "La camisa campera Guanaba en estampado de hoja tropical negro, crema y amarillo.",
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
        src: "/images/styles/orange-bloom-shirt.jpg",
        alt: {
          en: "The Amapola camp shirt in cream cotton with a large orange flower.",
          es: "La camisa campera Amapola en algodón crema con una flor naranja grande.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
  },
  {
    id: "wanaragua",
    slug: "wanaragua",
    name: { en: "Wanaragua wrap dress", es: "Vestido cruzado Wanaragua" },
    categoryId: "heritage",
    priceEntryId: "heritage--wax-print",
    color: { en: "Black, white and marigold", es: "Negro, blanco y amarillo" },
    description: {
      en: "A wrap front with a matching head wrap, drawn from Garífuna dress. Made in a run of twelve.",
      es: "Delantero cruzado con turbante a juego, inspirado en la vestimenta garífuna. Hecho en una serie de doce.",
    },
    detail: {
      en: "The skirt is cut in four panels so it turns properly when you move. Head wrap included, two metres, hemmed on all sides.",
      es: "La falda va cortada en cuatro paños para que gire bien al moverse. Turbante incluido, dos metros, con ruedo en todos los lados.",
    },
    sizes: [
      { sizeId: "s", inStock: true },
      { sizeId: "m", inStock: true },
      { sizeId: "l", inStock: true },
    ],
    photos: [
      {
        src: "/images/styles/garifuna-wrap-dress.jpg",
        alt: {
          en: "The Wanaragua wrap dress with a matching head wrap in black, white and marigold print.",
          es: "El vestido cruzado Wanaragua con turbante a juego en estampado negro, blanco y amarillo.",
        },
        isPrimary: true,
      },
    ],
    customizationAvailable: true,
    isPublished: true,
    premiereId: "otono-2026",
  },
];
