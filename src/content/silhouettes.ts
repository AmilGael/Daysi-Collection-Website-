/**
 * Fashion croquis for the design studio, drawn as SVG paths on a 600 × 820
 * frame. Each silhouette lists the panels that get the cloth and the seam lines
 * drawn over the top, which is what makes a flat fill read as a garment.
 *
 * `categoryId` ties a silhouette back to the price list, so the studio can show
 * what a piece in that shape and cloth actually costs.
 */
export type Silhouette = {
  readonly id: string;
  readonly categoryId: string;
  readonly name: { readonly en: string; readonly es: string };
  /** Filled with the chosen cloth. */
  readonly panels: readonly string[];
  /** Drawn on top in the trim colour: seams, plackets, collars, belts. */
  readonly seams: readonly string[];
};

export const silhouettes: readonly Silhouette[] = [
  {
    id: "puff-sleeve-dress",
    categoryId: "dresses",
    name: { en: "Puff-sleeve dress", es: "Vestido de manga abullonada" },
    panels: [
      "M242 196 L358 196 L352 332 C398 432 424 560 434 704 L166 704 C176 560 202 432 248 332 Z",
      "M242 196 C210 200 188 224 190 252 C192 282 216 294 236 282 L250 244 Z",
      "M358 196 C390 200 412 224 410 252 C408 282 384 294 364 282 L350 244 Z",
    ],
    seams: [
      "M248 332 L352 332",
      "M300 332 L300 704",
      "M242 196 L358 196",
    ],
  },
  {
    id: "square-neck-midi",
    categoryId: "dresses",
    name: { en: "Square-neck midi", es: "Midi de escote cuadrado" },
    panels: [
      "M252 194 L348 194 L344 336 C368 452 380 570 384 660 L216 660 C220 570 232 452 256 336 Z",
    ],
    seams: ["M256 336 L344 336", "M252 194 L348 194"],
  },
  {
    id: "palazzo-pants",
    categoryId: "pants",
    name: { en: "Palazzo pants", es: "Pantalón palazzo" },
    panels: [
      "M232 334 L368 334 C382 470 392 582 398 706 L316 706 L300 486 L284 706 L202 706 C208 582 218 470 232 334 Z",
    ],
    seams: ["M232 356 L368 356", "M300 356 L300 486"],
  },
  {
    id: "camp-shirt",
    categoryId: "shirts",
    name: { en: "Camp-collar shirt", es: "Camisa cuello campero" },
    panels: [
      "M236 202 L364 202 L370 254 L366 426 L234 426 L230 254 Z",
      "M236 202 C206 210 190 234 186 264 L226 280 L242 240 Z",
      "M364 202 C394 210 410 234 414 264 L374 280 L358 240 Z",
    ],
    seams: [
      "M300 214 L300 426",
      "M270 202 L300 236 L330 202",
      "M234 300 L262 300",
    ],
  },
  {
    id: "wrap-dress",
    categoryId: "heritage",
    name: { en: "Wrap dress and head wrap", es: "Vestido cruzado y turbante" },
    panels: [
      "M240 200 L360 200 L356 324 C396 442 418 572 428 706 L172 706 C182 572 204 442 244 324 Z",
      "M262 96 C282 74 318 74 338 96 C346 108 340 122 322 120 L278 120 C260 122 254 108 262 96 Z",
    ],
    seams: ["M246 212 L336 330 L356 324", "M244 324 L356 324"],
  },
];
